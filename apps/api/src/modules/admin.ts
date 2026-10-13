import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin, type Deps } from "../context.js";
import { tx } from "../db.js";
import { HttpError, safeEqual } from "../lib/util.js";
import { listCategories, toTree } from "./categories.js";
import { cleanupOrphans, mediaFor } from "./media.js";
import { notifyAlarmMatches } from "./notifications.js";

export function adminRoutes(app: FastifyInstance, deps: Deps) {
  const { pool, config } = deps;

  app.get("/admin/stats", async (req) => {
    requireAdmin(req);
    const { rows } = await pool.query(`SELECT
      (SELECT count(*)::int FROM users) AS users,
      (SELECT count(*)::int FROM requests WHERE status = 'active' AND expires_at > now()) AS active_requests,
      (SELECT count(*)::int FROM requests WHERE status = 'pending_review') AS pending_review,
      (SELECT count(*)::int FROM offers) AS offers,
      (SELECT count(*)::int FROM offers WHERE status = 'accepted') AS deals,
      (SELECT count(*)::int FROM reports) AS reports`);
    return rows[0];
  });

  // Kategoriler: gizli olanlar dahil hepsi.
  app.get("/admin/categories", async (req) => {
    requireAdmin(req);
    return { categories: toTree(await listCategories(pool, false)) };
  });

  app.patch("/admin/categories/:id", async (req) => {
    requireAdmin(req);
    const id = (req.params as { id: string }).id;
    const { is_visible } = z.object({ is_visible: z.boolean() }).parse(req.body);
    const r = await pool.query("UPDATE categories SET is_visible = $2 WHERE id = $1", [id, is_visible]);
    if (!r.rowCount) throw new HttpError(404, "bulunamadi", "Kategori bulunamadı.");
    return { ok: true };
  });

  // İnceleme bekleyen talepler ve şikayetler.
  app.get("/admin/moderation", async (req) => {
    requireAdmin(req);
    const pending = await pool.query(
      `SELECT r.id, r.title, r.description, r.moderation_note, r.created_at, u.name AS buyer_name
         FROM requests r JOIN users u ON u.id = r.buyer_id WHERE r.status = 'pending_review' ORDER BY r.created_at`);
    const reports = await pool.query(
      `SELECT rp.id, rp.request_id, rp.reason, rp.created_at, r.title, r.status
         FROM reports rp JOIN requests r ON r.id = rp.request_id ORDER BY rp.created_at DESC LIMIT 100`);
    // Yönetici, incelemedeki taleplerin fotoğraflarını da görür.
    const media = await mediaFor(pool, deps.storage, "request_id", pending.rows.map((r) => Number(r.id)));
    return { pending: pending.rows.map((r) => ({ ...r, media: media.get(Number(r.id)) ?? [] })), reports: reports.rows };
  });

  app.post("/admin/requests/:id/:action", async (req) => {
    requireAdmin(req);
    const p = z.object({ id: z.coerce.number().int(), action: z.enum(["approve", "reject", "remove"]) }).parse(req.params);
    const to = p.action === "approve" ? "active" : "rejected";
    const from = p.action === "remove" ? ["active", "pending_review"] : ["pending_review"];
    const r = await pool.query("UPDATE requests SET status = $2 WHERE id = $1 AND status = ANY($3) RETURNING id", [p.id, to, from]);
    if (!r.rowCount) throw new HttpError(404, "bulunamadi", "İşlem yapılabilecek talep bulunamadı.");
    if (to === "active") void notifyAlarmMatches(deps, p.id).catch(() => {});
    return { ok: true };
  });

  // Vitrine ekle / çıkar: days = 0 vitrinden çıkarır.
  app.post("/admin/requests/:id/vitrin", async (req) => {
    requireAdmin(req);
    const { id } = z.object({ id: z.coerce.number().int() }).parse(req.params);
    const { days } = z.object({ days: z.number().int().min(0).max(365) }).parse(req.body);
    const r = await pool.query<{ featured_until: string | null }>(
      "UPDATE requests SET featured_until = CASE WHEN $2::int > 0 THEN now() + make_interval(days => $2::int) END WHERE id = $1 RETURNING featured_until", [id, days]);
    if (!r.rowCount) throw new HttpError(404, "bulunamadi", "Talep bulunamadı.");
    return { featured_until: r.rows[0]!.featured_until };
  });

  app.get("/admin/settings", async (req) => {
    requireAdmin(req);
    const { rows } = await pool.query<{ key: string; value: unknown }>("SELECT key, value FROM settings ORDER BY key");
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  });

  app.put("/admin/settings", async (req) => {
    requireAdmin(req);
    const b = z.object({
      free_unlocks_per_month: z.number().int().min(0).max(1000).optional(),
      unlock_price_credits: z.number().int().min(0).max(1000).optional(),
      unlock_price_by_top: z.record(z.string().max(30), z.number().int().min(0).max(1000)).optional(),
      unlock_limit_per_request: z.number().int().min(0).max(1000).optional(),
      unlock_price_tiers: z.array(z.object({ max_budget: z.number().int().min(1).nullable(), credits: z.number().int().min(0).max(1000) })).max(10).optional(),
      max_active_requests_per_user: z.number().int().min(0).max(1000).optional(),
      browse_min_requests: z.number().int().min(0).max(1000).optional(),
      show_counts_min: z.number().int().min(0).max(100000).optional(),
      launch_mode: z.boolean().optional(),
      phone_required: z.boolean().optional(),
      home_urgent_box: z.boolean().optional(),
      photo_required: z.boolean().optional(),
      store_monthly_price_try: z.number().int().min(0).optional(),
      credit_packages: z.array(z.object({ id: z.string(), credits: z.number().int().min(1), price_try: z.number().int().min(0) })).max(10).optional(),
    }).parse(req.body);
    for (const [k, v] of Object.entries(b)) {
      if (v !== undefined) await pool.query("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [k, JSON.stringify(v)]);
    }
    return { ok: true };
  });

  // Ödeme altyapısı seçilene kadar yönetici elle kredi tanımlar.
  app.post("/admin/users/:id/credits", async (req) => {
    const admin = requireAdmin(req);
    const id = z.string().uuid().parse((req.params as { id: string }).id);
    const { delta, reason } = z.object({ delta: z.number().int().min(-1000).max(10000), reason: z.string().max(100).default("yonetici") }).parse(req.body);
    const credits = await tx(pool, async (c) => {
      const r = await c.query<{ credits: number }>("UPDATE users SET credits = credits + $2 WHERE id = $1 AND credits + $2 >= 0 RETURNING credits", [id, delta]);
      if (!r.rowCount) throw new HttpError(400, "gecersiz", "Kullanıcı bulunamadı veya kredi eksiye düşer.");
      await c.query("INSERT INTO credit_ledger (user_id, delta, reason, ref) VALUES ($1,$2,$3,$4)", [id, delta, reason, `admin:${admin.id}`]);
      return r.rows[0]!.credits;
    });
    return { credits };
  });

  app.get("/admin/users", async (req) => {
    requireAdmin(req);
    const { q } = z.object({ q: z.string().max(100).default("") }).parse(req.query);
    const { rows } = await pool.query(
      `SELECT id, name, email, phone, role, credits, created_at FROM users
        WHERE $1 = '' OR name ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%' OR phone LIKE '%' || $1 || '%'
        ORDER BY created_at DESC LIMIT 50`, [q]);
    return { items: rows };
  });

  // Cloud Scheduler tarafından çağrılan zamanlanmış iş: süresi dolan talepleri kapatır.
  app.post("/jobs/expire", async (req) => {
    const token = String(req.headers["x-job-token"] ?? "");
    if (!config.JOB_TOKEN || !safeEqual(token, config.JOB_TOKEN)) throw new HttpError(401, "yetkisiz", "Yetkisiz.");
    const r = await pool.query("UPDATE requests SET status = 'expired' WHERE status = 'active' AND expires_at <= now()");
    const s = await pool.query("DELETE FROM sessions WHERE expires_at <= now()");
    const c = await pool.query("DELETE FROM auth_codes WHERE created_at < now() - interval '2 days'");
    const m = await cleanupOrphans(pool, deps.storage);
    return { expired: r.rowCount, sessions_removed: s.rowCount, codes_removed: c.rowCount, media_removed: m };
  });
}
