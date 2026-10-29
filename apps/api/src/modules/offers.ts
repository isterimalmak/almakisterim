import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser, type Deps } from "../context.js";
import { tx } from "../db.js";
import { HttpError, maskContacts, idParam } from "../lib/util.js";
import { attachMedia, imageUrls, MediaIds } from "./media.js";
import { notifyUser, type MailPrefs } from "./notifications.js";
import { notify } from "./contacts.js";

const OfferBody = z.object({
  price: z.number().int().min(1).max(2_000_000_000),
  condition: z.string().trim().max(60).default(""),
  delivery: z.string().trim().max(60).default(""),
  warranty: z.boolean().default(false),
  note: z.string().trim().max(2000).default(""),
  media_ids: MediaIds,
});

export function offerRoutes(app: FastifyInstance, deps: Deps) {
  const { pool, ai, config, storage } = deps;

  app.post("/requests/:id/offers", { config: { rateLimit: { max: 30, timeWindow: "1 hour" } } }, async (req, reply) => {
    const user = requireUser(req);
    const requestId = idParam(req.params);
    const b = OfferBody.parse(req.body);
    const note = maskContacts(b.note).text;
    const mod = note ? await ai.moderate(note) : { verdict: "ok" as const, reason: "" };
    if (mod.verdict === "reject") throw new HttpError(400, "uygunsuz_icerik", "Teklif notu kurallara uygun değil: " + mod.reason);
    const img = await ai.moderateImages(await imageUrls(pool, storage, user.id, b.media_ids));
    if (img.verdict === "reject") throw new HttpError(400, "uygunsuz_gorsel", "Fotoğraflardan biri kurallara uygun değil: " + img.reason);

    const result = await tx(pool, async (c) => {
      const r = await c.query<{ buyer_id: string; title: string; status: string; open: boolean }>(
        `SELECT buyer_id, title, status, expires_at > now() AS open FROM requests WHERE id = $1 FOR UPDATE`, [requestId]);
      const row = r.rows[0];
      if (!row) throw new HttpError(404, "bulunamadi", "Talep bulunamadı.");
      if (row.buyer_id === user.id) throw new HttpError(400, "kendi_talebi", "Kendi talebinize teklif veremezsiniz.");
      if (row.status !== "active" || !row.open) throw new HttpError(409, "talep_kapali", "Bu talep artık teklif kabul etmiyor.");
      const dup = await c.query("SELECT 1 FROM offers WHERE request_id = $1 AND seller_id = $2", [requestId, user.id]);
      if (dup.rowCount) throw new HttpError(409, "zaten_teklif", "Bu talebe zaten teklif verdiniz.");

      // Teklif vermek için önce numaranın açılmış (ücretinin ödenmiş) olması gerekir.
      const unlocked = await c.query("SELECT 1 FROM contact_unlocks WHERE request_id = $1 AND seller_id = $2 AND revoked_at IS NULL", [requestId, user.id]);
      if (!unlocked.rowCount) throw new HttpError(402, "numara_acilmadi", "Teklif vermek için önce alıcının numarasını açın.");
      const ins = await c.query<{ id: number }>(
        `INSERT INTO offers (request_id, seller_id, price, condition, delivery, warranty, note) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [requestId, user.id, b.price, b.condition, b.delivery, b.warranty, note]);
      const offerId = ins.rows[0]!.id;
      await attachMedia(c, user.id, b.media_ids, { offer_id: offerId });
      const buyer = (await c.query<{ email: string | null; phone: string | null; mail_prefs: MailPrefs }>("SELECT email, phone, mail_prefs FROM users WHERE id = $1", [row.buyer_id])).rows[0]!;
      return { offerId, buyer, buyerId: row.buyer_id, title: row.title };
    });

    // Site içi bildirim ve telefon uygulamasına anlık bildirim; SMS/e-posta ayrıca.
    void notify(pool, result.buyerId, `"${result.title}" talebinize yeni bir teklif geldi.`, `/talep/${requestId}`, "offer").catch(() => {});
    void notifyUser(deps, result.buyer, "Talebinize yeni teklif geldi",
      `almakisterim: "${result.title}" talebinize yeni bir teklif geldi. ${config.APP_URL}/talep/${requestId}`, "offer").catch(() => {});
    reply.code(201);
    return { id: result.offerId };
  });

  app.post("/offers/:id/accept", async (req) => {
    const user = requireUser(req);
    const offerId = idParam(req.params);
    const out = await tx(pool, async (c) => {
      const o = await c.query<{ request_id: number; seller_id: string; buyer_id: string; status: string; req_status: string; title: string }>(
        `SELECT o.request_id, o.seller_id, r.buyer_id, o.status, r.status AS req_status, r.title
           FROM offers o JOIN requests r ON r.id = o.request_id WHERE o.id = $1 FOR UPDATE OF r`, [offerId]);
      const row = o.rows[0];
      if (!row || row.buyer_id !== user.id) throw new HttpError(404, "bulunamadi", "Teklif bulunamadı.");
      if (row.req_status !== "active" || row.status !== "active") throw new HttpError(409, "kabul_edilemez", "Bu teklif artık kabul edilemez.");
      await c.query("UPDATE offers SET status = CASE WHEN id = $1 THEN 'accepted' ELSE 'rejected' END WHERE request_id = $2 AND status = 'active'", [offerId, row.request_id]);
      await c.query("UPDATE requests SET status = 'closed', accepted_offer_id = $1 WHERE id = $2", [offerId, row.request_id]);
      const seller = (await c.query<{ email: string | null; phone: string | null; mail_prefs: MailPrefs }>("SELECT email, phone, mail_prefs FROM users WHERE id = $1", [row.seller_id])).rows[0]!;
      return { seller, sellerId: row.seller_id, title: row.title, requestId: row.request_id };
    });
    void notify(pool, out.sellerId, `"${out.title}" talebi için verdiğiniz teklif kabul edildi.`, `/talep/${out.requestId}`, "accepted").catch(() => {});
    void notifyUser(deps, out.seller, "Teklifiniz kabul edildi",
      `almakisterim: "${out.title}" talebi için verdiğiniz teklif kabul edildi. ${config.APP_URL}/talep/${out.requestId}`, "accepted").catch(() => {});
    return { ok: true };
  });

  app.post("/offers/:id/withdraw", async (req) => {
    const user = requireUser(req);
    const offerId = idParam(req.params);
    const r = await pool.query("UPDATE offers SET status = 'withdrawn' WHERE id = $1 AND seller_id = $2 AND status = 'active' RETURNING id", [offerId, user.id]);
    if (!r.rowCount) throw new HttpError(404, "bulunamadi", "Geri çekilebilecek teklif bulunamadı.");
    return { ok: true };
  });
}
