import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import { requireAdmin, requireUser, type Deps, type SessionUser } from "../context.js";
import { CONSENT_DOCS, LEGAL_DOCS, legalDoc, TERMS_SLUG, type LegalDoc } from "../data/legal/index.js";
import { HttpError } from "../lib/util.js";
import { safeSettings } from "./safe.js";
import { paymentsUi } from "./site.js";

// Sözleşmelerde görünen şirket bilgileri; yönetici Ayarlar'dan girer. Boş alanlar köşeli parantezle gösterilir.
export const COMPANY_FIELDS = {
  marka: "İşletme adı / tescilli marka", unvan: "Şirket unvanı", sorumlu: "Sorumlu kişi", sicil: "Ticaret sicil no",
  adres: "Adres", mersis: "MERSİS numarası", vergi: "Vergi dairesi ve numarası",
  kep: "KEP adresi", telefon: "Telefon", eposta: "E-posta", yetkili_yer: "Yetkili mahkeme yeri (ör. İstanbul (Çağlayan))",
} as const;
type Company = Partial<Record<keyof typeof COMPANY_FIELDS, string>>;
const DEFAULTS: Company = { marka: "almakisterim.com", eposta: "destek@almakisterim.com" };

async function company(pool: Pool): Promise<Company> {
  const v = (await pool.query<{ value: Company }>("SELECT value FROM settings WHERE key = 'legal_company'")).rows[0]?.value;
  return { ...DEFAULTS, ...(v && typeof v === "object" ? v : {}) };
}

async function fill(pool: Pool, doc: LegalDoc): Promise<LegalDoc> {
  const c = await company(pool);
  const st = await safeSettings(pool);
  const tr = (n: number) => n.toLocaleString("tr-TR");
  const vals: Record<string, string> = {
    ...Object.fromEntries(Object.entries(COMPANY_FIELDS).map(([k, label]) => [k.toUpperCase(), c[k as keyof Company]?.trim() || `[${label}]`])),
    GA_SATICI: tr(st.sellerPct), GA_ALICI: tr(st.buyerPct), GA_MIN: tr(st.minFee), GA_MAX: tr(st.maxFee),
    GA_UST: tr(st.maxPrice), GA_KARGO: String(st.shipDays), GA_ONAY: String(st.confirmDays),
  };
  const sub = (s: string) => s.replace(/\{\{([A-Z_]+)\}\}/g, (m, k: string) => vals[k] ?? m);
  return { ...doc, sections: doc.sections.map((x) => ({ h: sub(x.h), p: x.p.map(sub) })) };
}

// Metinler yönetimden düzenlenebilir: her kayıt yeni sürüm olarak legal_versions'a yazılır, en sonuncusu yürürlüktedir.
// Kayıt yoksa koddaki metin (data/legal) geçerlidir. Sürüm "ana.alt": küçük düzeltme alt numarayı, esaslı değişiklik
// ana numarayı artırır ve onay gerektiren metinlerde üyelerden yeniden onay istenir.
type Db = Pool | PoolClient;
type VersionRow = { slug: string; version: string; effective: string; title: string; summary: string; sections: LegalDoc["sections"]; reconsent: boolean; note: string | null; created_at: string };
const COLS = "slug, version, effective::text AS effective, title, summary, sections, reconsent, note, created_at";
const toDoc = (base: LegalDoc, r: VersionRow): LegalDoc => ({ ...base, version: r.version, effective: r.effective, title: r.title, summary: r.summary, sections: r.sections });
const vparts = (v: string) => v.split(".").map((x) => Number(x) || 0);
export const versionCmp = (a: string, b: string) => { const [a1 = 0, a2 = 0] = vparts(a), [b1 = 0, b2 = 0] = vparts(b); return a1 - b1 || a2 - b2; };

/** Yürürlükteki metin (yönetimden kaydedilen son sürüm ya da koddaki metin). */
export async function currentDoc(db: Db, slug: string): Promise<LegalDoc | null> {
  const base = legalDoc(slug);
  if (!base) return null;
  const r = (await db.query<VersionRow>(`SELECT ${COLS} FROM legal_versions WHERE slug = $1 ORDER BY id DESC LIMIT 1`, [slug])).rows[0];
  return r ? toDoc(base, r) : base;
}
export async function currentVersion(db: Db, slug: string) { return (await currentDoc(db, slug))?.version ?? null; }

async function allCurrent(pool: Pool): Promise<LegalDoc[]> {
  const { rows } = await pool.query<VersionRow>(`SELECT DISTINCT ON (slug) ${COLS} FROM legal_versions ORDER BY slug, id DESC`);
  const by = new Map(rows.map((r) => [r.slug, r]));
  return LEGAL_DOCS.map((d) => (by.has(d.slug) ? toDoc(d, by.get(d.slug)!) : d));
}

/** Yeniden onay gerektiren en son sürüm: üyenin onayladığı sürüm bundan eski olmamalı. */
async function minAcceptable(pool: Pool, slug: string) {
  const r = (await pool.query<{ version: string }>("SELECT version FROM legal_versions WHERE slug = $1 AND reconsent ORDER BY id DESC LIMIT 1", [slug])).rows[0];
  return r?.version ?? legalDoc(slug)?.version ?? "1.0";
}

const clientIp = (req: FastifyRequest) => String(req.headers["cf-connecting-ip"] ?? req.ip ?? "");

/** Onay kaydı: metnin yürürlükteki sürümüyle; IP ve tarayıcı bilgisi delil için saklanır. */
export async function recordConsent(db: Db, req: FastifyRequest, userId: string, docs: string[], context: string, granted = true) {
  for (const doc of docs) {
    const version = await currentVersion(db, doc);
    if (!version) throw new Error(`bilinmeyen metin: ${doc}`);
    await db.query("INSERT INTO consents (user_id, doc, version, granted, context, ip, user_agent) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [userId, doc, version, granted, context, clientIp(req).slice(0, 64), String(req.headers["user-agent"] ?? "").slice(0, 300)]);
  }
}

/** Üye Üyelik Sözleşmesi'ni, son esaslı değişiklikten sonraki bir sürümüyle onayladı mı? */
export async function termsAccepted(pool: Pool, userId: string) {
  const min = await minAcceptable(pool, TERMS_SLUG);
  const { rows } = await pool.query<{ version: string }>("SELECT DISTINCT version FROM consents WHERE user_id = $1 AND doc = $2 AND granted", [userId, TERMS_SLUG]);
  return rows.some((r) => versionCmp(r.version, min) >= 0);
}

export async function requireTerms(pool: Pool, user: SessionUser) {
  if (!(await termsAccepted(pool, user.id))) {
    throw new HttpError(428, "sozlesme_onayi_gerekli", "Devam etmek için Üyelik Sözleşmesi'ni onaylayın.");
  }
}

// Güvenli Al gibi işlemlerde istek gövdesindeki onay kutusu.
export const Accept = z.literal(true, { error: "Devam etmek için sözleşmeyi onaylayın." });

export function legalRoutes(app: FastifyInstance, { pool }: Deps) {
  app.get("/legal", async (req) => {
    const docs = await allCurrent(pool);
    const all = (req.query as { tum?: string }).tum === "1";
    // Gizlenen ödeme bölümlerinin metinleri listede gösterilmez (adresleriyle açılmaya devam eder).
    const ui = await paymentsUi(pool);
    const hidden = all ? [] : [...(ui.show_safe ? [] : ["guvenli-al-sozlesmesi"]), ...(ui.show_credits ? [] : ["on-bilgilendirme-formu", "mesafeli-satis-sozlesmesi"])];
    return {
      items: docs.filter((d) => !hidden.includes(d.slug)).map(({ slug, title, summary, version, effective }) => ({ slug, title, summary, version, effective })),
      terms: { slug: TERMS_SLUG, version: docs.find((d) => d.slug === TERMS_SLUG)!.version },
    };
  });

  // ?v=1.0 ile eski bir sürüm görüntülenir (üyenin onayladığı metin).
  app.get("/legal/:slug", async (req) => {
    const { slug } = z.object({ slug: z.string().max(60) }).parse(req.params);
    const { v } = z.object({ v: z.string().max(10).optional() }).parse(req.query);
    const base = legalDoc(slug);
    if (!base) throw new HttpError(404, "bulunamadi", "Metin bulunamadı.");
    let doc = await currentDoc(pool, slug);
    if (v && v !== doc!.version) {
      const r = (await pool.query<VersionRow>(`SELECT ${COLS} FROM legal_versions WHERE slug = $1 AND version = $2`, [slug, v])).rows[0];
      if (r) doc = toDoc(base, r);
      else if (v === base.version) doc = base;
      else throw new HttpError(404, "bulunamadi", "Bu sürüm bulunamadı.");
    }
    return { doc: await fill(pool, doc!), versions: await versions(pool, slug) };
  });

  // Üyenin verdiği onaylar: Üyelik Sözleşmesi (ekleriyle) ve isteğe bağlı ticari ileti onayı.
  app.post("/me/consents", { config: { rateLimit: { max: 30, timeWindow: "1 hour" } } }, async (req) => {
    const user = requireUser(req);
    const b = z.object({ terms: z.literal(true).optional(), marketing: z.boolean().optional(), context: z.string().max(40).optional() }).parse(req.body);
    const ctx = b.context ?? "onay";
    if (b.terms) await recordConsent(pool, req, user.id, [TERMS_SLUG], ctx);
    if (b.marketing !== undefined) {
      await recordConsent(pool, req, user.id, ["ticari-elektronik-ileti-onayi"], ctx, b.marketing);
      await pool.query(`UPDATE users SET marketing_at = ${b.marketing ? "COALESCE(marketing_at, now())" : "NULL"} WHERE id = $1`, [user.id]);
    }
    return { terms_ok: await termsAccepted(pool, user.id) };
  });

  app.get("/me/consents", async (req) => {
    const user = requireUser(req);
    const { rows } = await pool.query("SELECT doc, version, granted, context, created_at FROM consents WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200", [user.id]);
    return { items: rows.map((r) => ({ ...r, title: legalDoc(r.doc)?.title ?? r.doc })) };
  });

  // Yönetim: metnin düzenlenebilir hâli (yer tutucular doldurulmadan) ve sürüm geçmişi.
  app.get("/admin/legal/:slug", async (req) => {
    requireAdmin(req);
    const { slug } = z.object({ slug: z.string().max(60) }).parse(req.params);
    const doc = await currentDoc(pool, slug);
    if (!doc) throw new HttpError(404, "bulunamadi", "Metin bulunamadı.");
    return { doc, versions: await versions(pool, slug) };
  });

  app.put("/admin/legal/:slug", async (req) => {
    const admin = requireAdmin(req);
    const { slug } = z.object({ slug: z.string().max(60) }).parse(req.params);
    const cur = await currentDoc(pool, slug);
    if (!cur) throw new HttpError(404, "bulunamadi", "Metin bulunamadı.");
    const b = z.object({
      title: z.string().trim().min(3).max(150),
      summary: z.string().trim().max(400).default(""),
      sections: z.array(z.object({ h: z.string().trim().min(1, "Her bölümün başlığı olmalı.").max(200), p: z.array(z.string().trim().min(1).max(5000)).min(1, "Her bölümde en az bir paragraf olmalı.").max(80) })).min(1).max(60),
      change: z.enum(["kucuk", "esasli"]),
      effective: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      note: z.string().trim().max(300).optional(),
    }).parse(req.body);
    const [major = 1, minor = 0] = vparts(cur.version);
    const version = b.change === "esasli" ? `${major + 1}.0` : `${major}.${minor + 1}`;
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
    await pool.query(
      "INSERT INTO legal_versions (slug, version, effective, title, summary, sections, reconsent, note, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [slug, version, b.effective ?? today, b.title, b.summary, JSON.stringify(b.sections), b.change === "esasli" && !!cur.consent, b.note ?? null, admin.id]);
    return { doc: await currentDoc(pool, slug), versions: await versions(pool, slug) };
  });

  // İletişim sayfasındaki şirket bilgileri (yalnızca girilmiş olanlar).
  app.get("/company", async () => {
    const c = await company(pool);
    return { company: Object.fromEntries(Object.entries(c).filter(([k, v]) => k !== "yetkili_yer" && typeof v === "string" && v.trim())) };
  });

  app.get("/admin/legal-info", async (req) => {
    requireAdmin(req);
    return { fields: COMPANY_FIELDS, value: await company(pool) };
  });

  app.put("/admin/legal-info", async (req) => {
    requireAdmin(req);
    const shape = Object.fromEntries(Object.keys(COMPANY_FIELDS).map((k) => [k, z.string().trim().max(300).optional()]));
    const b = z.object(shape).strict().parse(req.body) as Company;
    await pool.query("INSERT INTO settings (key, value) VALUES ('legal_company', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify(b)]);
    return { value: await company(pool) };
  });

  // Bir üyenin onay geçmişi (uyuşmazlık ve KVKK başvurularında).
  app.get("/admin/users/:id/consents", async (req) => {
    requireAdmin(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { rows } = await pool.query("SELECT doc, version, granted, context, ip, user_agent, created_at FROM consents WHERE user_id = $1 ORDER BY created_at DESC LIMIT 500", [id]);
    return { items: rows.map((r) => ({ ...r, title: legalDoc(r.doc)?.title ?? r.doc })) };
  });
}

// Sürüm geçmişi: koddaki ilk sürüm ve yönetimden kaydedilenler (yeniden eskiye).
async function versions(pool: Pool, slug: string) {
  const base = legalDoc(slug)!;
  const { rows } = await pool.query<VersionRow>(`SELECT ${COLS} FROM legal_versions WHERE slug = $1 ORDER BY id DESC`, [slug]);
  const out = rows.map((r) => ({ version: r.version, effective: r.effective, reconsent: r.reconsent, note: r.note, created_at: r.created_at as string | null }));
  if (!rows.some((r) => r.version === base.version)) out.push({ version: base.version, effective: base.effective, reconsent: false, note: "İlk sürüm", created_at: null });
  return out;
}

export { CONSENT_DOCS };
