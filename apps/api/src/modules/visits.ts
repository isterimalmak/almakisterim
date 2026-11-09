import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin, type Deps } from "../context.js";
import type { Pool } from "../db.js";
import { HttpError } from "../lib/util.js";

// Yönetim → Ziyaretçiler: kim hangi sayfaya girdi, ne kadar kaldı, nereden çıktı; kim ne zaman giriş yaptı.
// Sayfa kayıtlarını site yalnız çerez kutusunda "Kabul et" diyen ziyaretçiler için gönderir (Çerez Politikası, analiz çerezleri).
// Ziyaretçi numarası tarayıcıda üretilen rastgele bir değerdir; üye giriş yaptıysa kayıt hesabına bağlanır. Kayıtlar 90 gün saklanır.

export const VISIT_DAYS = 90;
// Arama motoru ve otomatik tarayıcılar sayılmaz.
const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|whatsapp|python|curl|wget/i;

// Giriş kaydı (her yöntem: SMS/e-posta kodu, Google, Apple, uygulama).
export async function logLogin(db: Pick<Pool, "query">, userId: string) {
  await db.query("INSERT INTO visits (kind, user_id) VALUES ('login', $1)", [userId]).catch(() => {});
}
export const cleanupVisits = (pool: Pool) => pool.query(`DELETE FROM visits WHERE created_at < now() - interval '${VISIT_DAYS} days'`);

const Visitor = z.string().regex(/^[a-z0-9]{16,40}$/);
const TrackBody = z.object({
  visitor: Visitor,
  path: z.string().max(300).regex(/^\/[^\s#]*$/),
  ref: z.string().max(100).regex(/^[a-z0-9.-]*$/i).default(""),
  device: z.enum(["mobil", "masaustu", ""]).default(""),
});
const LeaveBody = z.object({ id: z.coerce.number().int().positive(), visitor: Visitor, ms: z.coerce.number().int().min(0) });

export function visitRoutes(app: FastifyInstance, deps: Deps) {
  const { pool } = deps;

  app.post("/track", { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } }, async (req) => {
    if (BOT.test(String(req.headers["user-agent"] ?? ""))) return { id: null };
    const b = TrackBody.parse(req.body);
    // Sorgu dizesindeki kişisel bilgi (arama sözcüğü, kod) saklanmaz; yalnız sayfa yolu.
    const path = b.path.split("?")[0]!.slice(0, 200);
    // Önceki sayfanın çıkış bildirimi gelmediyse (hızlı geçiş, sekme kapanırken kaybolan bildirim) süresi bu geçişten hesaplanır.
    await pool.query(
      `UPDATE visits SET duration_ms = LEAST(extract(epoch FROM now() - created_at) * 1000, 30 * 60 * 1000)::int
        WHERE id = (SELECT id FROM visits WHERE visitor = $1 AND kind = 'view' AND created_at > now() - interval '30 minutes'
                     ORDER BY created_at DESC LIMIT 1) AND duration_ms IS NULL`, [b.visitor]);
    const { rows } = await pool.query<{ id: string }>(
      "INSERT INTO visits (visitor, user_id, path, ref, device) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [b.visitor, req.user?.id ?? null, path, b.ref.toLowerCase(), b.device]);
    return { id: Number(rows[0]!.id) };
  });

  // Sayfadan çıkış: o sayfada geçen süre (tarayıcı sekmesi kapanırken de gönderilir). En fazla 6 saat sayılır.
  app.post("/track/leave", { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } }, async (req) => {
    const raw = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
    const b = LeaveBody.parse(raw);
    await pool.query("UPDATE visits SET duration_ms = $3 WHERE id = $1 AND visitor = $2 AND kind = 'view' AND duration_ms IS NULL",
      [b.id, b.visitor, Math.min(b.ms, 6 * 3600 * 1000)]);
    return { ok: true };
  });

  app.get("/admin/visits", async (req) => {
    requireAdmin(req);
    const q = z.object({ days: z.coerce.number().int().min(1).max(VISIT_DAYS).default(1), q: z.string().trim().max(80).default("") }).parse(req.query);
    const since = `now() - make_interval(days => $1)`;
    const like = q.q ? `%${q.q.replace(/[%_\\]/g, "\\$&")}%` : null;
    const who = like ? "AND (u.name ILIKE $2 OR u.email ILIKE $2 OR u.phone ILIKE $2)" : "";
    const args = like ? [q.days, like] : [q.days];
    const [sum, pages, sessions, logins] = await Promise.all([
      pool.query<{ visitors: number; members: number; views: number; logins: number; avg_ms: number | null }>(
        `SELECT count(DISTINCT visitor) FILTER (WHERE kind = 'view')::int AS visitors,
                count(DISTINCT user_id) FILTER (WHERE kind = 'view')::int AS members,
                count(*) FILTER (WHERE kind = 'view')::int AS views,
                count(*) FILTER (WHERE kind = 'login')::int AS logins,
                round(avg(duration_ms))::int AS avg_ms
           FROM visits WHERE created_at > ${since}`, [q.days]),
      pool.query<{ path: string; views: number; visitors: number; avg_ms: number | null }>(
        `SELECT path, count(*)::int AS views, count(DISTINCT visitor)::int AS visitors, round(avg(duration_ms))::int AS avg_ms
           FROM visits WHERE kind = 'view' AND created_at > ${since} GROUP BY path ORDER BY views DESC LIMIT 20`, [q.days]),
      // Ziyaretçi başına: kim (üyeyse), ilk ve son sayfa (giriş/çıkış), sayfa sayısı, toplam süre, cihaz, geldiği site.
      pool.query(
        `SELECT v.visitor, max(u.name) AS name, max(u.email) AS email, max(u.phone) AS phone, bool_or(v.user_id IS NOT NULL) AS member,
                min(v.created_at) AS first_at, max(v.created_at) AS last_at, count(*)::int AS views,
                coalesce(sum(v.duration_ms), 0)::bigint AS total_ms,
                (array_agg(v.path ORDER BY v.created_at))[1] AS entry,
                (array_agg(v.path ORDER BY v.created_at DESC))[1] AS exit,
                (array_agg(v.device ORDER BY v.created_at))[1] AS device,
                (array_agg(v.ref ORDER BY v.created_at))[1] AS ref
           FROM visits v LEFT JOIN users u ON u.id = v.user_id
          WHERE v.kind = 'view' AND v.created_at > ${since} ${who}
          GROUP BY v.visitor ORDER BY max(v.created_at) DESC LIMIT 100`, args),
      pool.query(
        `SELECT v.created_at, u.name, u.email, u.phone FROM visits v JOIN users u ON u.id = v.user_id
          WHERE v.kind = 'login' AND v.created_at > ${since} ${who} ORDER BY v.created_at DESC LIMIT 100`, args),
    ]);
    return {
      days: q.days, summary: sum.rows[0],
      pages: pages.rows,
      sessions: sessions.rows.map((r) => ({ ...r, total_ms: Number(r.total_ms) })),
      logins: logins.rows,
    };
  });

  // Bir ziyaretçinin gezdiği sayfalar sırasıyla (giriş → çıkış) ve her sayfada geçen süre.
  app.get("/admin/visits/:visitor", async (req) => {
    requireAdmin(req);
    const { visitor } = z.object({ visitor: Visitor }).parse(req.params);
    const { days } = z.object({ days: z.coerce.number().int().min(1).max(VISIT_DAYS).default(VISIT_DAYS) }).parse(req.query);
    const { rows } = await pool.query(
      `SELECT v.id, v.path, v.created_at, v.duration_ms, v.device, v.ref, u.name, u.email, u.phone
         FROM visits v LEFT JOIN users u ON u.id = v.user_id
        WHERE v.visitor = $1 AND v.kind = 'view' AND v.created_at > now() - make_interval(days => $2)
        ORDER BY v.created_at LIMIT 500`, [visitor, days]);
    if (!rows.length) throw new HttpError(404, "bulunamadi", "Bu ziyaretçiye ait kayıt yok.");
    return { items: rows };
  });
}
