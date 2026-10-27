import type { FastifyInstance } from "fastify";
import { recordConsent, termsAccepted } from "./legal.js";
import { z } from "zod";
import { requireUser, SESSION_COOKIE, type Deps } from "../context.js";
import { tx } from "../db.js";
import { HttpError, idParam } from "../lib/util.js";
import { CITIES } from "../services/ai.js";
import { unreadMessages } from "./messages.js";
import { VISIBLE_CATEGORY_SQL } from "./categories.js";
import { freeUnlocksUsed, unlockSettings } from "./contacts.js";
import { aiSettings, logAiAction } from "../services/ai-guard.js";
import { ALARM_SELECT, alarmQuery, cleanAlarmFilters, type AlarmRow } from "./alarms.js";
import { FROM, listFilters } from "./requests.js";
import { MAIL_KINDS, wantsMail, type MailPrefs } from "./notifications.js";

export function meRoutes(app: FastifyInstance, deps: Deps) {
  const { pool } = deps;
  app.get("/me", async (req) => {
    if (!req.user) return { user: null };
    const s = await unlockSettings(pool);
    const used = await freeUnlocksUsed(pool, req.user.id);
    const unread = (await pool.query<{ n: number }>("SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL", [req.user.id])).rows[0]!.n;
    const unreadMsg = await unreadMessages(pool, req.user.id);
    // Kampanya e-postası izni (E-posta Stüdyosu)
    const u = (await pool.query<{ marketing: boolean; mail_prefs: MailPrefs }>("SELECT marketing_at IS NOT NULL AS marketing, mail_prefs FROM users WHERE id = $1", [req.user.id])).rows[0]!;
    const mail_prefs = Object.fromEntries(MAIL_KINDS.map((k) => [k, wantsMail(u.mail_prefs, k)]));
    return { user: { ...req.user, marketing: u.marketing, mail_prefs, free_unlocks_left: Math.max(0, s.free - used), unlock_price: s.launch ? 0 : s.price, launch_mode: s.launch, unread_notifications: unread, unread_messages: unreadMsg,
      // Üyelik Sözleşmesi'nin yürürlükteki sürümü onaylanmadıysa site ve uygulama onay penceresi gösterir.
      terms_ok: await termsAccepted(pool, req.user.id) } };
  });

  app.patch("/me", async (req) => {
    const user = requireUser(req);
    const b = z.object({ name: z.string().trim().min(2).max(80).optional(), is_corporate: z.boolean().optional(), marketing: z.boolean().optional(),
      mail_prefs: z.object({ offer: z.boolean(), accepted: z.boolean(), message: z.boolean() }).partial().strict().optional() }).parse(req.body);
    if (b.name && b.name !== user.name && (await aiSettings(pool)).names) {
      const r = await deps.ai.checkName(b.name);
      if (r.verdict === "block") {
        await logAiAction(pool, { kind: "ad_engel", target: user.id, summary: `"${b.name.slice(0, 60)}" adı engellendi: ${r.reason}` });
        throw new HttpError(400, "ad_uygunsuz", `Bu ad kullanılamaz${r.reason ? `: ${r.reason}` : ""}.`);
      }
    }
    await pool.query("UPDATE users SET name = COALESCE($2, name), is_corporate = COALESCE($3, is_corporate) WHERE id = $1",
      [user.id, b.name ?? null, b.is_corporate ?? null]);
    // Kampanya e-postası izni: açılınca izin zamanı yazılır, kapatılınca silinir (sıradaki kampanya e-postaları gönderilirken atlanır).
    if (b.marketing !== undefined) {
      await pool.query("UPDATE users SET marketing_at = CASE WHEN $2 THEN coalesce(marketing_at, now()) ELSE NULL END WHERE id = $1", [user.id, b.marketing]);
      await recordConsent(pool, req, user.id, ["ticari-elektronik-ileti-onayi"], "hesap", b.marketing);
    }
    if (b.mail_prefs) await pool.query("UPDATE users SET mail_prefs = mail_prefs || $2::jsonb WHERE id = $1", [user.id, JSON.stringify(b.mail_prefs)]);
    return { ok: true };
  });

  // Hesap silme (Google Play / App Store zorunluluğu). Kişisel bilgiler silinir, açık talepler kapanır, oturumlar düşer.
  // Satış ve ödeme kayıtları yasal saklama için anonim kalır; karşı tarafa yazılan mesajlar "Silinmiş üye" adıyla görünür.
  app.delete("/me", async (req, reply) => {
    const user = requireUser(req);
    z.object({ onay: z.literal("SİL", { error: "Silmek için kutuya büyük harflerle SİL yazın." }) }).parse(req.body ?? {});
    if (user.role === "admin") throw new HttpError(409, "yonetici_silinemez", "Yönetici hesabı buradan silinemez.");
    const email = await tx(pool, async (c) => {
      const open = (await c.query("SELECT 1 FROM safe_sales WHERE (buyer_id = $1 OR seller_id = $1) AND status IN ('odeme_bekliyor', 'odendi', 'kargoda', 'sorunlu') LIMIT 1", [user.id])).rowCount;
      if (open) throw new HttpError(409, "satis_suruyor", "Devam eden bir Güvenli Al satışınız var. Satış tamamlandıktan ya da iptal edildikten sonra hesabınızı silebilirsiniz.");
      const u = (await c.query<{ email: string | null; phone: string | null }>("SELECT email, phone FROM users WHERE id = $1 FOR UPDATE", [user.id])).rows[0]!;
      await c.query("UPDATE requests SET status = 'closed' WHERE buyer_id = $1 AND status IN ('pending_review', 'active')", [user.id]);
      await c.query("UPDATE offers SET status = 'withdrawn' WHERE seller_id = $1 AND status = 'active'", [user.id]);
      for (const t of ["sessions", "alarms", "favorites", "notifications", "push_tokens"]) await c.query(`DELETE FROM ${t} WHERE user_id = $1`, [user.id]);
      await c.query("DELETE FROM mail_sends WHERE user_id = $1 AND status = 'queued'", [user.id]);
      await c.query("DELETE FROM auth_codes WHERE target = ANY($1::text[])", [[u.email, u.phone].filter(Boolean)]);
      await c.query(`UPDATE users SET email = NULL, phone = NULL, google_sub = NULL, apple_sub = NULL, name = 'Silinmiş üye', iban = NULL, iban_name = NULL,
                       marketing_at = NULL, mail_prefs = '{}'::jsonb, deleted_at = now() WHERE id = $1`, [user.id]);
      return u.email;
    });
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    if (email) void deps.mailer.send(email, "Hesabınız silindi",
      `Merhaba,\n\nalmakisterim.com hesabınız isteğiniz üzerine silindi. Adınız, telefon numaranız ve e-posta adresiniz sistemden kaldırıldı; açık talepleriniz kapatıldı.\n\nBu işlemi siz yapmadıysanız destek@almakisterim.com adresine yazın.`).catch(() => {});
    return { ok: true };
  });

  // Telefon uygulamasının anlık bildirim adresi (Expo). Aynı telefon başka hesapla girerse adres o hesaba geçer.
  app.post("/me/push-token", async (req) => {
    const user = requireUser(req);
    const b = z.object({ token: z.string().max(200).regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, "Geçersiz bildirim adresi."), platform: z.enum(["ios", "android"]) }).parse(req.body);
    await pool.query(`INSERT INTO push_tokens (token, user_id, platform) VALUES ($1, $2, $3)
                      ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, created_at = now()`, [b.token, user.id, b.platform]);
    return { ok: true };
  });

  app.get("/me/requests", async (req) => {
    const user = requireUser(req);
    const { rows } = await pool.query(
      `SELECT r.id, r.title, r.status, r.budget_min, r.budget_max, r.city, r.created_at, r.expires_at, c.name AS category_name,
              (SELECT count(*)::int FROM offers o WHERE o.request_id = r.id AND o.status <> 'withdrawn') AS offer_count
         FROM requests r JOIN categories c ON c.id = r.category_id WHERE r.buyer_id = $1 ORDER BY r.created_at DESC LIMIT 200`, [user.id]);
    return { items: rows };
  });

  app.get("/me/offers", async (req) => {
    const user = requireUser(req);
    const { rows } = await pool.query(
      `SELECT o.id, o.price, o.status, o.created_at, r.id AS request_id, r.title, r.status AS request_status
         FROM offers o JOIN requests r ON r.id = o.request_id WHERE o.seller_id = $1 ORDER BY o.created_at DESC LIMIT 200`, [user.id]);
    return { items: rows };
  });

  // Satıcıya uygun talepler: alarmlarının (kaydedilmiş aramalarının) herhangi birine uyan açık talepler.
  app.get("/me/matches", async (req) => {
    const user = requireUser(req);
    const alarms = (await pool.query<AlarmRow>(ALARM_SELECT + " WHERE a.user_id = $1", [user.id])).rows;
    const ids = new Set<number>();
    for (const a of alarms) {
      const { where, params } = listFilters(alarmQuery(a));
      params.push(user.id);
      const r = await pool.query<{ id: number }>(`SELECT r.id ${FROM} WHERE ${where.join(" AND ")} AND r.buyer_id <> $${params.length} ORDER BY r.id DESC LIMIT 100`, params);
      r.rows.forEach((x) => ids.add(Number(x.id)));
    }
    if (!ids.size) return { items: [] };
    const { rows } = await pool.query(
      `SELECT r.id, r.title, r.budget_min, r.budget_max, r.city, r.created_at, c.name AS category_name,
              (SELECT count(*)::int FROM offers o WHERE o.request_id = r.id AND o.status <> 'withdrawn') AS offer_count,
              EXISTS (SELECT 1 FROM offers o WHERE o.request_id = r.id AND o.seller_id = $2) AS already_offered
         FROM requests r JOIN categories c ON c.id = r.category_id WHERE r.id = ANY($1::bigint[]) ORDER BY r.id DESC LIMIT 100`, [[...ids], user.id]);
    return { items: rows };
  });

  app.get("/me/alarms", async (req) => {
    const user = requireUser(req);
    const { rows } = await pool.query(
      `SELECT a.id, a.category_id, c.name AS category_name, p.name AS top_name, a.filters, a.created_at
         FROM alarms a JOIN categories c ON c.id = a.category_id LEFT JOIN categories p ON p.id = c.parent_id
        WHERE a.user_id = $1 ORDER BY a.created_at DESC`, [user.id]);
    return { items: rows };
  });

  // Alarm kur: kategori + talep listesindeki süzgeçlerin aynısı (eski istemciler için city/min_budget de kabul edilir).
  app.post("/me/alarms", async (req, reply) => {
    const user = requireUser(req);
    const b = z.object({
      category_id: z.string(), city: z.string().optional(), min_budget: z.number().int().min(0).optional(),
      filters: z.record(z.string().max(30), z.union([z.string().max(300), z.number()])).default({}),
    }).parse(req.body);
    const filters = cleanAlarmFilters({ ...(b.city ? { city: b.city } : {}), ...(b.min_budget ? { bmin: String(b.min_budget) } : {}), ...b.filters });
    const count = (await pool.query<{ n: number }>("SELECT count(*)::int AS n FROM alarms WHERE user_id = $1", [user.id])).rows[0]!.n;
    if (count >= 20) throw new HttpError(400, "alarm_siniri", "En fazla 20 alarm kurabilirsiniz.");
    const cat = await pool.query("SELECT 1 FROM categories WHERE id = $1", [b.category_id]);
    if (!cat.rowCount) throw new HttpError(400, "kategori_gecersiz", "Kategori bulunamadı.");
    const { rows } = await pool.query<{ id: number }>("INSERT INTO alarms (user_id, category_id, city, min_budget, filters) VALUES ($1,$2,$3,$4,$5) RETURNING id",
      [user.id, b.category_id, filters.city ?? "", Number(filters.bmin) || 0, filters]);
    reply.code(201);
    return { id: rows[0]!.id };
  });

  app.delete("/me/alarms/:id", async (req) => {
    const user = requireUser(req);
    const id = idParam(req.params);
    await pool.query("DELETE FROM alarms WHERE id = $1 AND user_id = $2", [id, user.id]);
    return { ok: true };
  });

  app.get("/me/favorites", async (req) => {
    const user = requireUser(req);
    const { rows } = await pool.query(
      `SELECT r.id, r.title, r.status, r.budget_min, r.budget_max, r.city, r.created_at
         FROM favorites f JOIN requests r ON r.id = f.request_id WHERE f.user_id = $1 ORDER BY f.created_at DESC`, [user.id]);
    return { items: rows };
  });

  app.put("/me/favorites/:id", async (req) => {
    const user = requireUser(req);
    const id = idParam(req.params);
    await pool.query("INSERT INTO favorites (user_id, request_id) SELECT $1, id FROM requests WHERE id = $2 ON CONFLICT DO NOTHING", [user.id, id]);
    return { ok: true };
  });

  app.delete("/me/favorites/:id", async (req) => {
    const user = requireUser(req);
    const id = idParam(req.params);
    await pool.query("DELETE FROM favorites WHERE user_id = $1 AND request_id = $2", [user.id, id]);
    return { ok: true };
  });
}
