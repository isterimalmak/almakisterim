import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import { requireAdmin, requireUser, type Deps, type SessionUser } from "../context.js";
import { CONSENT_DOCS, currentVersion, LEGAL_DOCS, legalDoc, TERMS_SLUG, type LegalDoc } from "../data/legal/index.js";
import { HttpError } from "../lib/util.js";
import { safeSettings } from "./safe.js";

// Sözleşmelerde görünen şirket bilgileri; yönetici Ayarlar'dan girer. Boş alanlar köşeli parantezle gösterilir.
export const COMPANY_FIELDS = {
  unvan: "Şirket unvanı", adres: "Adres", mersis: "MERSİS numarası", vergi: "Vergi dairesi ve numarası",
  kep: "KEP adresi", telefon: "Telefon", eposta: "E-posta", yetkili_yer: "Yetkili mahkeme yeri (ör. İstanbul (Çağlayan))",
} as const;
type Company = Partial<Record<keyof typeof COMPANY_FIELDS, string>>;
const DEFAULTS: Company = { eposta: "destek@almakisterim.com" };

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

const clientIp = (req: FastifyRequest) => String(req.headers["cf-connecting-ip"] ?? req.ip ?? "");

/** Onay kaydı: metnin yürürlükteki sürümüyle; IP ve tarayıcı bilgisi delil için saklanır. */
export async function recordConsent(db: Pool | PoolClient, req: FastifyRequest, userId: string, docs: string[], context: string, granted = true) {
  for (const doc of docs) {
    const version = currentVersion(doc);
    if (!version) throw new Error(`bilinmeyen metin: ${doc}`);
    await db.query("INSERT INTO consents (user_id, doc, version, granted, context, ip, user_agent) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [userId, doc, version, granted, context, clientIp(req).slice(0, 64), String(req.headers["user-agent"] ?? "").slice(0, 300)]);
  }
}

/** Üye Üyelik Sözleşmesi'nin yürürlükteki sürümünü onayladı mı? */
export async function termsAccepted(pool: Pool, userId: string) {
  const r = await pool.query("SELECT 1 FROM consents WHERE user_id = $1 AND doc = $2 AND version = $3 AND granted LIMIT 1", [userId, TERMS_SLUG, currentVersion(TERMS_SLUG)]);
  return !!r.rowCount;
}

export async function requireTerms(pool: Pool, user: SessionUser) {
  if (!(await termsAccepted(pool, user.id))) {
    throw new HttpError(428, "sozlesme_onayi_gerekli", "Devam etmek için Üyelik Sözleşmesi'ni onaylayın.");
  }
}

// Güvenli Al gibi işlemlerde istek gövdesindeki onay kutusu.
export const Accept = z.literal(true, { error: "Devam etmek için sözleşmeyi onaylayın." });

export function legalRoutes(app: FastifyInstance, { pool }: Deps) {
  app.get("/legal", async () => ({
    items: LEGAL_DOCS.map(({ slug, title, summary, version, effective }) => ({ slug, title, summary, version, effective })),
    terms: { slug: TERMS_SLUG, version: currentVersion(TERMS_SLUG) },
  }));

  app.get("/legal/:slug", async (req) => {
    const { slug } = z.object({ slug: z.string().max(60) }).parse(req.params);
    const doc = legalDoc(slug);
    if (!doc) throw new HttpError(404, "bulunamadi", "Metin bulunamadı.");
    return { doc: await fill(pool, doc) };
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

export { CONSENT_DOCS };
