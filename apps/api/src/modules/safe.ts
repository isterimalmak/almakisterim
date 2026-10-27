import type { FastifyInstance, FastifyRequest } from "fastify";
import { recordConsent, requireTerms } from "./legal.js";
import { z } from "zod";
import { requireAdmin, requireUser, type Deps } from "../context.js";
import { tx, type Client, type Pool } from "../db.js";
import { HttpError, idParam, maskContacts, publicName } from "../lib/util.js";
import { disabledPayments } from "../services/payments.js";
import { notify } from "./contacts.js";

// Güvenli Al: satıcı, iletişime geçtiği talep için satış başlatır; alıcı kartla öder, para sitede bekler.
// Satıcı kargolar → alıcı "Ürünü aldım" der (ya da onay süresi dolar) → satış tamamlanır, para satıcıya gönderilir.
// Alıcı "Sorun var" derse otomatik onay durur, yönetici iade ya da ödeme kararı verir.

export type SafeSettings = {
  enabled: boolean; sellerPct: number; buyerPct: number; minFee: number; maxFee: number; maxPrice: number;
  shipDays: number; confirmDays: number; tops: string[];
};

export async function safeSettings(pool: Pool): Promise<SafeSettings> {
  const { rows } = await pool.query<{ key: string; value: unknown }>("SELECT key, value FROM settings WHERE key LIKE 'safe\\_%'");
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const num = (k: string, d: number) => (typeof s[k] === "number" ? (s[k] as number) : d);
  return {
    enabled: s.safe_enabled !== false, sellerPct: num("safe_seller_pct", 5), buyerPct: num("safe_buyer_pct", 1.5),
    minFee: num("safe_min_fee", 25), maxFee: num("safe_max_fee", 2500), maxPrice: num("safe_max_price", 250000),
    shipDays: num("safe_ship_days", 5), confirmDays: num("safe_confirm_days", 10),
    tops: Array.isArray(s.safe_tops) ? (s.safe_tops as string[]) : [],
  };
}

// Komisyon (kuruş): satıcı payı en az/en fazla sınırıyla, alıcı hizmet bedeli yüzde olarak.
export function safeFees(price: number, s: Pick<SafeSettings, "sellerPct" | "buyerPct" | "minFee" | "maxFee">) {
  const raw = Math.round((price * s.sellerPct) / 100);
  const seller = Math.min(price, Math.max(s.minFee * 100, Math.min(raw, s.maxFee * 100)));
  const buyer = Math.round((price * s.buyerPct) / 100);
  return { seller_fee: seller, buyer_fee: buyer, total: price + buyer, payout: price - seller };
}

// TR IBAN: TR + 24 hane, mod-97 denetimi.
export function normalizeIban(raw: string): string | null {
  const i = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^TR\d{24}$/.test(i)) return null;
  const moved = (i.slice(4) + i.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rem = 0;
  for (const ch of moved) rem = (rem * 10 + Number(ch)) % 97;
  return rem === 1 ? i : null;
}
export const ibanTxt = (i: string) => i.replace(/(.{4})/g, "$1 ").trim();

type Sale = {
  id: number; request_id: number | null; seller_id: string; buyer_id: string; title: string; description: string;
  price: number; seller_fee: number; buyer_fee: number; status: string; provider: string; pay_token: string | null; pay_items: { tx: string; price: number }[] | null;
  ship_name: string | null; ship_phone: string | null; ship_city: string | null; ship_address: string | null;
  cargo_company: string | null; tracking_no: string | null; dispute_reason: string | null; admin_note: string | null;
  paid_at: string | null; shipped_at: string | null; release_at: string | null; completed_at: string | null; refunded_at: string | null;
  payout_at: string | null; payout_note: string | null; created_at: string;
};

const STATUS_TXT: Record<string, string> = {
  odeme_bekliyor: "Ödeme bekleniyor", odendi: "Ödendi, kargo bekleniyor", kargoda: "Kargoda", sorunlu: "Sorun bildirildi",
  tamamlandi: "Tamamlandı", iade: "İade edildi", iptal: "İptal edildi",
};

const Create = z.object({
  request_id: z.number().int(),
  title: z.string().trim().min(3, "Ürün adı en az 3 karakter olmalı.").max(120),
  description: z.string().trim().max(1000).default(""),
  price: z.number().min(10, "Fiyat en az 10 TL olmalı."),
  iban: z.string().max(40).optional(),
  iban_name: z.string().trim().max(80).optional(),
  // Güvenli Al Hizmet Sözleşmesi onayı (satıcı satış başlatırken, alıcı ödemeden önce).
  accept: z.literal(true, { error: "Devam etmek için Güvenli Al Hizmet Sözleşmesi'ni onaylayın." }),
});
const Pay = z.object({
  ship_name: z.string().trim().min(3, "Ad soyad yazın.").max(80),
  ship_phone: z.string().trim().min(10, "Telefon numarası yazın.").max(20),
  ship_city: z.string().trim().min(2, "İl yazın.").max(40),
  ship_address: z.string().trim().min(10, "Açık adresi yazın (mahalle, sokak, no).").max(400),
  accept: z.literal(true, { error: "Ödemeden önce Güvenli Al Hizmet Sözleşmesi'ni onaylayın." }),
});
const Ship = z.object({
  cargo_company: z.string().trim().min(2, "Kargo firmasını yazın.").max(40),
  tracking_no: z.string().trim().min(4, "Kargo takip numarasını yazın.").max(40),
});

type Db = Pool | Client;
const ip = (req: FastifyRequest) => String(req.headers["cf-connecting-ip"] ?? req.ip ?? "127.0.0.1");

// Satış işlemleri: hem rotalardan hem saatlik işten çağrılır.
export function saleOps(deps: Deps) {
  const { pool, config } = deps;
  const pay = () => deps.payments ?? disabledPayments;

  const log = (db: Db, saleId: number, actor: string | null, kind: string, note = "") =>
    db.query("INSERT INTO safe_sale_events (sale_id, actor_id, kind, note) VALUES ($1, $2, $3, $4)", [saleId, actor, kind, note]);
  // Site içi bildirim her zaman; e-postası olan üyeye ayrıca e-posta (işlem bildirimi olduğu için kapatılamaz).
  const tell = async (userId: string, text: string, saleId: number) => {
    await notify(pool, userId, text, `/guvenli-al/${saleId}`).catch(() => {});
    const u = (await pool.query<{ email: string | null }>("SELECT email FROM users WHERE id = $1", [userId])).rows[0];
    if (u?.email) await deps.mailer.send(u.email, "Güvenli Al: " + text.slice(0, 60), `${text}\n\n${config.APP_URL}/guvenli-al/${saleId}\n\nalmakisterim.com`).catch(() => {});
  };
  const load = async (id: number, db: Db = pool, lock = false) =>
    (await db.query<Sale>(`SELECT * FROM safe_sales WHERE id = $1${lock ? " FOR UPDATE" : ""}`, [id])).rows[0];

  // Ödemeyi doğrular ve satışı "ödendi" yapar. Satış bu arada iptal edildiyse para hemen iade edilir.
  const settlePayment = async (saleId: number, token: string, ipAddr: string) => {
    const s = await load(saleId);
    if (!s || s.pay_token !== token) return "bulunamadi";
    if (s.status !== "odeme_bekliyor" && s.status !== "iptal") return s.status === "odendi" ? "ok" : s.status;
    const r = await pay().verify(token, saleId);
    if (!r.ok || r.paid < s.price + s.buyer_fee) return "hata";
    const st = await safeSettings(pool);
    const out = await tx(pool, async (c) => {
      const cur = (await load(saleId, c, true))!;
      if (cur.status === "odeme_bekliyor") {
        await c.query(`UPDATE safe_sales SET status = 'odendi', paid_at = now(), pay_ref = $2, pay_items = $3, provider = $4, updated_at = now() WHERE id = $1`,
          [saleId, r.ref, JSON.stringify(r.items), pay().name]);
        await log(c, saleId, cur.buyer_id, "odendi");
        return "ok";
      }
      if (cur.status === "iptal") {
        await c.query(`UPDATE safe_sales SET pay_ref = $2, pay_items = $3, provider = $4, updated_at = now() WHERE id = $1`, [saleId, r.ref, JSON.stringify(r.items), pay().name]);
        return "iptal";
      }
      return cur.status;
    });
    if (out === "ok") {
      await tell(s.seller_id, `"${s.title}" için ödeme yapıldı. Ürünü ${st.shipDays} gün içinde kargolayıp takip numarasını girin.`, saleId);
      await tell(s.buyer_id, `"${s.title}" ödemeniz alındı. Paranız ürünü teslim alıp onaylayana kadar güvende bekliyor.`, saleId);
    } else if (out === "iptal") {
      await refund(saleId, null, "iptal edilmiş satışa gelen ödeme iade edildi", ipAddr).catch(() => {});
      return "iptal";
    }
    return out;
  };

  const refund = async (saleId: number, actor: string | null, note: string, ipAddr: string) => {
    const s = (await load(saleId))!;
    if (s.pay_items?.length) await pay().refund(saleId, s.pay_items, ipAddr);
    await pool.query(`UPDATE safe_sales SET status = 'iade', refunded_at = now(), release_at = NULL, updated_at = now() WHERE id = $1`, [saleId]);
    await log(pool, saleId, actor, "iade", note);
    await tell(s.buyer_id, `"${s.title}" için ödediğiniz ${((s.price + s.buyer_fee) / 100).toLocaleString("tr-TR")} TL kartınıza iade edildi.`, saleId);
    await tell(s.seller_id, `"${s.title}" satışı iptal edildi, ödeme alıcıya iade edildi.`, saleId);
  };
  const complete = async (saleId: number, actor: string | null, kind: string) => {
    const s = (await load(saleId))!;
    await pool.query(`UPDATE safe_sales SET status = 'tamamlandi', completed_at = now(), release_at = NULL, updated_at = now() WHERE id = $1`, [saleId]);
    await log(pool, saleId, actor, kind);
    await tell(s.seller_id, `"${s.title}" satışı tamamlandı. ${((s.price - s.seller_fee) / 100).toLocaleString("tr-TR")} TL hesabınıza gönderilecek.`, saleId);
    if (kind !== "onaylandi") await tell(s.buyer_id, `"${s.title}" satışı tamamlandı.`, saleId);
  };
  return { pay, log, tell, load, settlePayment, refund, complete };
}

export function safeRoutes(app: FastifyInstance, deps: Deps) {
  const { pool, config } = deps;
  const { pay, log, tell, load, settlePayment, refund, complete } = saleOps(deps);

  const view = async (s: Sale, viewer: { id: string; role: string }) => {
    const role = s.buyer_id === viewer.id ? "alici" : s.seller_id === viewer.id ? "satici" : "yonetici";
    const names = (await pool.query<{ id: string; name: string }>("SELECT id, name FROM users WHERE id IN ($1, $2)", [s.seller_id, s.buyer_id])).rows;
    const nm = (id: string) => publicName(names.find((n) => n.id === id)?.name ?? "");
    const events = (await pool.query<{ kind: string; note: string; created_at: string }>("SELECT kind, note, created_at FROM safe_sale_events WHERE sale_id = $1 ORDER BY id", [s.id])).rows;
    const st = await safeSettings(pool);
    const paid = !["odeme_bekliyor", "iptal"].includes(s.status);
    return {
      id: Number(s.id), request_id: s.request_id ? Number(s.request_id) : null, title: s.title, description: s.description, role,
      price: s.price, buyer_fee: s.buyer_fee, total: s.price + s.buyer_fee,
      ...(role !== "alici" ? { seller_fee: s.seller_fee, payout: s.price - s.seller_fee } : {}),
      status: s.status, status_text: STATUS_TXT[s.status] ?? s.status, mode: s.provider || pay().name,
      seller_name: nm(s.seller_id), buyer_name: nm(s.buyer_id),
      // Teslimat adresi ödeme yapıldıktan sonra yalnızca satıcıya (ve alıcının kendisine) görünür.
      ship: paid || role === "alici" ? { name: s.ship_name, phone: s.ship_phone, city: s.ship_city, address: s.ship_address } : null,
      cargo_company: s.cargo_company, tracking_no: s.tracking_no, dispute_reason: s.dispute_reason,
      created_at: s.created_at, paid_at: s.paid_at, shipped_at: s.shipped_at, release_at: s.release_at, completed_at: s.completed_at,
      refunded_at: s.refunded_at, payout_at: s.payout_at,
      ship_deadline: s.paid_at ? new Date(new Date(s.paid_at).getTime() + st.shipDays * 86400_000).toISOString() : null,
      events,
    };
  };
  const mine = async (req: FastifyRequest, id: number) => {
    const user = requireUser(req);
    const s = await load(id);
    if (!s || (s.buyer_id !== user.id && s.seller_id !== user.id && user.role !== "admin")) throw new HttpError(404, "bulunamadi", "Satış bulunamadı.");
    return { user, s };
  };

  // Tek adımlık durum değişikliği: satır kilitlenir, beklenen durumda değilse işlem yapılmaz.
  const step = async (id: number, from: string[], fn: (s: Sale, c: Db) => Promise<void>) =>
    tx(pool, async (c) => {
      const s = await load(id, c, true);
      if (!s) throw new HttpError(404, "bulunamadi", "Satış bulunamadı.");
      if (!from.includes(s.status)) throw new HttpError(409, "durum_uygun_degil", `Bu işlem şu an yapılamaz (durum: ${STATUS_TXT[s.status] ?? s.status}).`);
      await fn(s, c);
      return s;
    });

  app.get("/safe/info", async (req) => {
    const st = await safeSettings(pool);
    const me = req.user ? (await pool.query<{ iban: string | null; iban_name: string | null }>("SELECT iban, iban_name FROM users WHERE id = $1", [req.user.id])).rows[0] : null;
    return {
      enabled: st.enabled && pay().enabled, mode: pay().name, seller_pct: st.sellerPct, buyer_pct: st.buyerPct, min_fee: st.minFee, max_fee: st.maxFee,
      max_price: st.maxPrice, ship_days: st.shipDays, confirm_days: st.confirmDays, tops: st.tops,
      iban: me?.iban ?? null, iban_name: me?.iban_name ?? null,
    };
  });

  app.put("/me/iban", async (req) => {
    const user = requireUser(req);
    const b = z.object({ iban: z.string().max(40), iban_name: z.string().trim().min(3, "Hesap sahibinin adını yazın.").max(80) }).parse(req.body);
    const iban = normalizeIban(b.iban);
    if (!iban) throw new HttpError(400, "iban_gecersiz", "IBAN geçersiz. TR ile başlayan 26 karakterlik IBAN'ı kontrol edin.");
    await pool.query("UPDATE users SET iban = $2, iban_name = $3 WHERE id = $1", [user.id, iban, b.iban_name]);
    return { iban, iban_name: b.iban_name };
  });

  // Satıcı satış başlatır: alıcıyla iletişimi açmış olmalı, talep kargolanabilir bir kategoride olmalı.
  app.post("/safe/sales", { config: { rateLimit: { max: 20, timeWindow: "1 hour" } } }, async (req, reply) => {
    const user = requireUser(req);
    await requireTerms(pool, user);
    const b = Create.parse(req.body);
    const st = await safeSettings(pool);
    if (!st.enabled || !pay().enabled) throw new HttpError(503, "kapali", "Güvenli Al şu anda kullanılamıyor.");
    const price = Math.round(b.price * 100);
    if (price > st.maxPrice * 100) throw new HttpError(400, "fiyat_yuksek", `Güvenli Al ile en fazla ${st.maxPrice.toLocaleString("tr-TR")} TL'lik satış yapılabilir.`);
    const r = (await pool.query<{ buyer_id: string; top: string | null }>(
      "SELECT r.buyer_id, c.parent_id AS top FROM requests r JOIN categories c ON c.id = r.category_id WHERE r.id = $1", [b.request_id])).rows[0];
    if (!r) throw new HttpError(404, "bulunamadi", "Talep bulunamadı.");
    if (r.buyer_id === user.id) throw new HttpError(400, "kendi_talebi", "Kendi talebinize satış yapamazsınız.");
    if (!st.tops.includes(r.top ?? "")) throw new HttpError(400, "kategori_kapali", "Bu kategoride Güvenli Al kullanılamıyor (yalnızca kargoyla gönderilebilen ürünler).");
    const acc = (await pool.query<{ revoked: boolean }>("SELECT revoked_at IS NOT NULL AS revoked FROM contact_unlocks WHERE request_id = $1 AND seller_id = $2", [b.request_id, user.id])).rows[0];
    if (!acc) throw new HttpError(402, "iletisim_acilmadi", "Güvenli Al ile satış için önce alıcıyla iletişimi açın.");
    if (acc.revoked) throw new HttpError(403, "engellendi", "Alıcı sizinle iletişimi durdurdu.");
    if (b.iban !== undefined) {
      const iban = normalizeIban(b.iban);
      if (!iban) throw new HttpError(400, "iban_gecersiz", "IBAN geçersiz. TR ile başlayan 26 karakterlik IBAN'ı kontrol edin.");
      if (!b.iban_name || b.iban_name.length < 3) throw new HttpError(400, "iban_ad", "Hesap sahibinin adını yazın.");
      await pool.query("UPDATE users SET iban = $2, iban_name = $3 WHERE id = $1", [user.id, iban, b.iban_name]);
    }
    const has = (await pool.query<{ iban: string | null }>("SELECT iban FROM users WHERE id = $1", [user.id])).rows[0]?.iban;
    if (!has) throw new HttpError(400, "iban_gerekli", "Paranızın gönderileceği IBAN'ı girin.");
    const open = await pool.query("SELECT 1 FROM safe_sales WHERE request_id = $1 AND seller_id = $2 AND status = 'odeme_bekliyor'", [b.request_id, user.id]);
    if (open.rowCount) throw new HttpError(409, "acik_satis", "Bu talep için ödeme bekleyen bir satışınız zaten var.");
    const f = safeFees(price, st);
    const desc = maskContacts(b.description).text;
    const id = await tx(pool, async (c) => {
      const ins = await c.query<{ id: number }>(
        `INSERT INTO safe_sales (request_id, seller_id, buyer_id, title, description, price, seller_fee, buyer_fee, provider) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [b.request_id, user.id, r.buyer_id, maskContacts(b.title).text, desc, price, f.seller_fee, f.buyer_fee, pay().name]);
      const id = Number(ins.rows[0]!.id);
      await log(c, id, user.id, "olusturuldu");
      await recordConsent(c, req, user.id, ["guvenli-al-sozlesmesi"], `guvenli-al:${id}`);
      return id;
    });
    await tell(r.buyer_id, `Satıcı "${b.title}" için Güvenli Al ile ${(price / 100).toLocaleString("tr-TR")} TL'lik satış başlattı. Ödemeniz ürünü teslim alana kadar güvende bekler.`, id);
    reply.code(201);
    return view((await load(id))!, user);
  });

  app.get("/safe/sales", async (req) => {
    const user = requireUser(req);
    const { request_id } = z.object({ request_id: z.coerce.number().int().optional() }).parse(req.query);
    const { rows } = await pool.query<Sale & { seller_name: string; buyer_name: string }>(
      `SELECT s.*, us.name AS seller_name, ub.name AS buyer_name FROM safe_sales s JOIN users us ON us.id = s.seller_id JOIN users ub ON ub.id = s.buyer_id
        WHERE (s.seller_id = $1 OR s.buyer_id = $1) AND ($2::bigint IS NULL OR s.request_id = $2) ORDER BY s.created_at DESC LIMIT 100`, [user.id, request_id ?? null]);
    return { items: rows.map((s) => ({
      id: Number(s.id), request_id: s.request_id ? Number(s.request_id) : null, title: s.title, role: s.buyer_id === user.id ? "alici" : "satici",
      price: s.price, total: s.price + s.buyer_fee, payout: s.seller_id === user.id ? s.price - s.seller_fee : undefined,
      status: s.status, status_text: STATUS_TXT[s.status] ?? s.status, other_name: publicName(s.buyer_id === user.id ? s.seller_name : s.buyer_name), created_at: s.created_at,
    })) };
  });

  app.get("/safe/sales/:id", async (req) => {
    const { user, s } = await mine(req, idParam(req.params));
    return view(s, user);
  });

  // Alıcı teslimat adresini yazar ve ödeme sayfasına gider.
  app.post("/safe/sales/:id/pay", { config: { rateLimit: { max: 20, timeWindow: "1 hour" } } }, async (req) => {
    const { user, s } = await mine(req, idParam(req.params));
    if (s.buyer_id !== user.id) throw new HttpError(403, "yetki_yok", "Ödemeyi yalnızca alıcı yapabilir.");
    if (s.status !== "odeme_bekliyor") throw new HttpError(409, "durum_uygun_degil", "Bu satışın ödemesi artık yapılamaz.");
    await requireTerms(pool, user);
    const b = Pay.parse(req.body);
    await recordConsent(pool, req, user.id, ["guvenli-al-sozlesmesi"], `guvenli-al:${s.id}`);
    if (!pay().enabled) throw new HttpError(503, "kapali", "Ödeme altyapısı şu anda kullanılamıyor.");
    const buyer = (await pool.query<{ email: string | null; phone: string | null }>("SELECT email, phone FROM users WHERE id = $1", [user.id])).rows[0]!;
    let started: { token: string; url: string };
    try {
      started = await pay().start({
        saleId: s.id, total: s.price + s.buyer_fee, ip: ip(req), callbackUrl: `${config.APP_URL}/api/safe/callback?sale=${s.id}`,
        items: [{ id: `urun-${s.id}`, name: s.title, price: s.price }, ...(s.buyer_fee ? [{ id: `hizmet-${s.id}`, name: "Güvenli Al hizmet bedeli", price: s.buyer_fee, virtual: true }] : [])],
        buyer: { id: user.id, name: b.ship_name, email: buyer.email, phone: buyer.phone, city: b.ship_city, address: b.ship_address },
      });
    } catch (e) {
      req.log.warn({ err: (e as Error).message, sale: s.id }, "ödeme başlatılamadı");
      throw new HttpError(502, "odeme_baslatilamadi", "Ödeme sayfası açılamadı, lütfen biraz sonra tekrar deneyin.");
    }
    await pool.query(`UPDATE safe_sales SET ship_name = $2, ship_phone = $3, ship_city = $4, ship_address = $5, pay_token = $6, updated_at = now() WHERE id = $1`,
      [s.id, b.ship_name, b.ship_phone, b.ship_city, b.ship_address, started.token]);
    return { url: started.url };
  });

  // Ödeme sağlayıcısı alıcıyı buraya gönderir (form gönderimi); sonuç sağlayıcıdan ayrıca sorgulanır.
  app.post("/safe/callback", async (req, reply) => {
    const { sale } = z.object({ sale: z.coerce.number().int() }).parse(req.query);
    const token = String((req.body as { token?: string } | null)?.token ?? "");
    const r = token ? await settlePayment(sale, token, ip(req)) : "hata";
    return reply.redirect(`${config.APP_URL}/guvenli-al/${sale}?odeme=${r === "ok" ? "tamam" : "hata"}`, 303);
  });

  // Yalnızca deneme modunda (iyzico anahtarı girilmeden, canlı dışında): sitenin kendi deneme ödeme ekranı.
  app.post("/safe/sales/:id/test-pay", async (req) => {
    const { user, s } = await mine(req, idParam(req.params));
    if (pay().name !== "test") throw new HttpError(404, "bulunamadi", "Deneme ödemesi kapalı.");
    if (s.buyer_id !== user.id) throw new HttpError(403, "yetki_yok", "Ödemeyi yalnızca alıcı yapabilir.");
    const { token } = z.object({ token: z.string().max(100) }).parse(req.body);
    const r = await settlePayment(s.id, token, ip(req));
    if (r !== "ok") throw new HttpError(400, "odeme_hatasi", "Deneme ödemesi tamamlanamadı.");
    return view((await load(s.id))!, user);
  });

  app.post("/safe/sales/:id/ship", async (req) => {
    const { user, s } = await mine(req, idParam(req.params));
    if (s.seller_id !== user.id) throw new HttpError(403, "yetki_yok", "Kargo bilgisini yalnızca satıcı girer.");
    const b = Ship.parse(req.body);
    const st = await safeSettings(pool);
    await step(s.id, ["odendi"], async (_s, c) => {
      await c.query(`UPDATE safe_sales SET status = 'kargoda', cargo_company = $2, tracking_no = $3, shipped_at = now(), release_at = now() + make_interval(days => $4), updated_at = now() WHERE id = $1`,
        [s.id, b.cargo_company, b.tracking_no, st.confirmDays]);
      await log(c, s.id, user.id, "kargolandi", `${b.cargo_company} · ${b.tracking_no}`);
    });
    await tell(s.buyer_id, `"${s.title}" kargoya verildi (${b.cargo_company}, takip no ${b.tracking_no}). Ürünü teslim alınca kontrol edip onaylayın; ${st.confirmDays} gün içinde onay ya da sorun bildirimi gelmezse satış otomatik tamamlanır.`, s.id);
    return view((await load(s.id))!, user);
  });

  app.post("/safe/sales/:id/confirm", async (req) => {
    const { user, s } = await mine(req, idParam(req.params));
    if (s.buyer_id !== user.id) throw new HttpError(403, "yetki_yok", "Onayı yalnızca alıcı verir.");
    await step(s.id, ["kargoda", "sorunlu"], async () => {});
    await complete(s.id, user.id, "onaylandi");
    return view((await load(s.id))!, user);
  });

  app.post("/safe/sales/:id/dispute", async (req) => {
    const { user, s } = await mine(req, idParam(req.params));
    if (s.buyer_id !== user.id) throw new HttpError(403, "yetki_yok", "Sorunu yalnızca alıcı bildirir.");
    const { reason } = z.object({ reason: z.string().trim().min(10, "Sorunu en az 10 karakterle anlatın.").max(1000) }).parse(req.body);
    await step(s.id, ["odendi", "kargoda"], async (_s, c) => {
      await c.query(`UPDATE safe_sales SET status = 'sorunlu', dispute_reason = $2, release_at = NULL, updated_at = now() WHERE id = $1`, [s.id, reason]);
      await log(c, s.id, user.id, "sorun", reason);
    });
    await tell(s.seller_id, `"${s.title}" için alıcı sorun bildirdi. Ekibimiz inceleyip iki tarafla da iletişime geçecek; para bu sürede bekletilir.`, s.id);
    return view((await load(s.id))!, user);
  });

  app.post("/safe/sales/:id/cancel", async (req) => {
    const { user, s } = await mine(req, idParam(req.params));
    if (s.buyer_id !== user.id && s.seller_id !== user.id) throw new HttpError(403, "yetki_yok", "Bu satışı iptal edemezsiniz.");
    await step(s.id, ["odeme_bekliyor"], async (_s, c) => {
      await c.query(`UPDATE safe_sales SET status = 'iptal', updated_at = now() WHERE id = $1`, [s.id]);
      await log(c, s.id, user.id, "iptal");
    });
    await tell(user.id === s.buyer_id ? s.seller_id : s.buyer_id, `"${s.title}" Güvenli Al satışı iptal edildi.`, s.id);
    return view((await load(s.id))!, user);
  });

  /* ---------------- Yönetim → Güvenli Al ---------------- */

  app.get("/admin/safe", async (req) => {
    requireAdmin(req);
    const { status } = z.object({ status: z.string().max(20).optional() }).parse(req.query);
    const { rows } = await pool.query<Sale & { seller_name: string; seller_phone: string | null; iban: string | null; iban_name: string | null; buyer_name: string; buyer_phone: string | null }>(
      `SELECT s.*, us.name AS seller_name, us.phone AS seller_phone, us.iban, us.iban_name, ub.name AS buyer_name, ub.phone AS buyer_phone
         FROM safe_sales s JOIN users us ON us.id = s.seller_id JOIN users ub ON ub.id = s.buyer_id
        WHERE ($1::text IS NULL OR s.status = $1 OR ($1 = 'odenecek' AND s.status = 'tamamlandi' AND s.payout_at IS NULL))
        ORDER BY (s.status = 'sorunlu') DESC, s.updated_at DESC LIMIT 200`, [status || null]);
    const t = (await pool.query<{ held: string; to_pay: string; earned: string; open: number }>(
      `SELECT coalesce(sum(price + buyer_fee) FILTER (WHERE status IN ('odendi', 'kargoda', 'sorunlu')), 0) AS held,
              coalesce(sum(price - seller_fee) FILTER (WHERE status = 'tamamlandi' AND payout_at IS NULL), 0) AS to_pay,
              coalesce(sum(seller_fee + buyer_fee) FILTER (WHERE status = 'tamamlandi'), 0) AS earned,
              count(*) FILTER (WHERE status = 'sorunlu')::int AS open
         FROM safe_sales`)).rows[0]!;
    const st = await safeSettings(pool);
    return {
      mode: pay().name, totals: { held: Number(t.held), to_pay: Number(t.to_pay), earned: Number(t.earned), disputes: t.open },
      settings: { safe_enabled: st.enabled, safe_seller_pct: st.sellerPct, safe_buyer_pct: st.buyerPct, safe_min_fee: st.minFee, safe_max_fee: st.maxFee,
        safe_max_price: st.maxPrice, safe_ship_days: st.shipDays, safe_confirm_days: st.confirmDays, safe_tops: st.tops },
      items: rows.map((s) => ({
        id: Number(s.id), request_id: s.request_id ? Number(s.request_id) : null, title: s.title, price: s.price, seller_fee: s.seller_fee, buyer_fee: s.buyer_fee,
        payout: s.price - s.seller_fee, status: s.status, status_text: STATUS_TXT[s.status] ?? s.status, created_at: s.created_at, paid_at: s.paid_at,
        seller_name: s.seller_name, seller_phone: s.seller_phone, iban: s.iban ? ibanTxt(s.iban) : null, iban_name: s.iban_name,
        buyer_name: s.buyer_name, buyer_phone: s.buyer_phone, cargo_company: s.cargo_company, tracking_no: s.tracking_no,
        dispute_reason: s.dispute_reason, payout_at: s.payout_at, payout_note: s.payout_note, admin_note: s.admin_note, release_at: s.release_at,
      })),
    };
  });

  app.put("/admin/safe/settings", async (req) => {
    requireAdmin(req);
    const pct = z.number().min(0).max(50);
    const b = z.object({
      safe_enabled: z.boolean().optional(), safe_seller_pct: pct.optional(), safe_buyer_pct: pct.optional(),
      safe_min_fee: z.number().min(0).max(100000).optional(), safe_max_fee: z.number().min(0).max(1000000).optional(),
      safe_max_price: z.number().int().min(100).max(10_000_000).optional(),
      safe_ship_days: z.number().int().min(1).max(30).optional(), safe_confirm_days: z.number().int().min(1).max(60).optional(),
      safe_tops: z.array(z.string().max(30)).max(30).optional(),
    }).parse(req.body);
    if (b.safe_min_fee !== undefined && b.safe_max_fee !== undefined && b.safe_min_fee > b.safe_max_fee) throw new HttpError(400, "gecersiz", "En az komisyon en fazladan büyük olamaz.");
    for (const [k, v] of Object.entries(b)) {
      if (v !== undefined) await pool.query("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [k, JSON.stringify(v)]);
    }
    return { ok: true };
  });

  // Sorunlu (ya da bekleyen) satışta karar: alıcıya iade ya da satıcıya ödeme.
  app.post("/admin/safe/:id/resolve", async (req) => {
    const admin = requireAdmin(req);
    const id = idParam(req.params);
    const { action, note } = z.object({ action: z.enum(["refund", "release"]), note: z.string().trim().max(500).default("") }).parse(req.body);
    await step(id, ["odendi", "kargoda", "sorunlu"], async (_s, c) => { if (note) await c.query("UPDATE safe_sales SET admin_note = $2 WHERE id = $1", [id, note]); });
    if (action === "refund") {
      try { await refund(id, admin.id, note || "yönetici kararıyla iade", ip(req)); }
      catch (e) {
        req.log.warn({ err: (e as Error).message, sale: id }, "iade yapılamadı");
        throw new HttpError(502, "iade_yapilamadi", `İade yapılamadı: ${(e as Error).message}. iyzico panelinden elle iade edip tekrar deneyin.`);
      }
    } else await complete(id, admin.id, "yonetici_onayi");
    return { ok: true };
  });

  // Satıcıya banka havalesi yapıldı olarak işaretle.
  app.post("/admin/safe/:id/payout", async (req) => {
    const admin = requireAdmin(req);
    const id = idParam(req.params);
    const { note } = z.object({ note: z.string().trim().max(200).default("") }).parse(req.body);
    const s = await step(id, ["tamamlandi"], async (cur, c) => {
      if (cur.payout_at) throw new HttpError(409, "zaten_odendi", "Bu satışın parası zaten gönderildi.");
      await c.query("UPDATE safe_sales SET payout_at = now(), payout_note = $2, updated_at = now() WHERE id = $1", [id, note]);
      await log(c, id, admin.id, "saticiya_odendi", note);
    });
    await tell(s.seller_id, `"${s.title}" satışınızın ${((s.price - s.seller_fee) / 100).toLocaleString("tr-TR")} TL tutarındaki ödemesi hesabınıza gönderildi.`, id);
    return { ok: true };
  });

}

// Saatlik iş: onay süresi dolan kargolar tamamlanır, süresinde kargolanmayan satışlar iade edilir, ödenmeyen satışlar iptal olur.
export async function safeJobs(deps: Deps) {
  const { pool } = deps;
  const ops = saleOps(deps);
  const st = await safeSettings(pool);
  const done = (await pool.query<{ id: number }>("SELECT id FROM safe_sales WHERE status = 'kargoda' AND release_at <= now()")).rows;
  for (const r of done) await ops.complete(Number(r.id), null, "otomatik_onay").catch(() => {});
  const late = (await pool.query<{ id: number }>("SELECT id FROM safe_sales WHERE status = 'odendi' AND paid_at < now() - make_interval(days => $1)", [st.shipDays])).rows;
  let refunded = 0;
  for (const r of late) {
    try { await ops.refund(Number(r.id), null, `${st.shipDays} gün içinde kargolanmadı`, "127.0.0.1"); refunded++; } catch { /* yönetici panelinden elle */ }
  }
  const stale = await pool.query(`UPDATE safe_sales SET status = 'iptal', updated_at = now() WHERE status = 'odeme_bekliyor' AND created_at < now() - interval '7 days'`);
  return { completed: done.length, refunded, cancelled: stale.rowCount ?? 0 };
}
