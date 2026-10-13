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

  // Panelin ana ekranı: sayaçlar, son 7 günün yeni üyeleri, son 6 ayın talepleri/kredileri ve son hareketler.
  app.get("/admin/dashboard", async (req) => {
    requireAdmin(req);
    const day = `date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul'`;
    const month = `date_trunc('month', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul'`;
    const totals = (await pool.query(`SELECT
      (SELECT count(*)::int FROM users) AS users,
      (SELECT count(*)::int FROM users WHERE created_at >= ${day}) AS users_today,
      (SELECT count(*)::int FROM requests WHERE status = 'active' AND expires_at > now()) AS active_requests,
      (SELECT count(*)::int FROM requests WHERE status = 'pending_review') AS pending_review,
      (SELECT count(*)::int FROM requests WHERE created_at >= ${month}) AS requests_month,
      (SELECT count(*)::int FROM contact_unlocks WHERE created_at >= ${month}) AS unlocks_month,
      (SELECT COALESCE(sum(credits), 0)::int FROM contact_unlocks WHERE created_at >= ${month}) AS credits_month,
      (SELECT count(*)::int FROM messages WHERE created_at >= ${day}) AS messages_today,
      (SELECT count(*)::int FROM contact_reports WHERE status = 'open') AS open_reports`)).rows[0];
    // Gün ve ay sınırları İstanbul saatine göre.
    const users7 = (await pool.query<{ d: string; n: number }>(
      `SELECT to_char(g.d, 'YYYY-MM-DD') AS d, count(u.id)::int AS n
         FROM generate_series((now() AT TIME ZONE 'Europe/Istanbul')::date - 6, (now() AT TIME ZONE 'Europe/Istanbul')::date, interval '1 day') AS g(d)
         LEFT JOIN users u ON (u.created_at AT TIME ZONE 'Europe/Istanbul')::date = g.d::date
        GROUP BY g.d ORDER BY g.d`)).rows;
    const months = (await pool.query<{ m: string; requests: number; credits: number }>(
      `SELECT to_char(g.m, 'YYYY-MM') AS m,
              (SELECT count(*)::int FROM requests r WHERE date_trunc('month', r.created_at AT TIME ZONE 'Europe/Istanbul') = g.m) AS requests,
              (SELECT COALESCE(sum(cu.credits), 0)::int FROM contact_unlocks cu WHERE date_trunc('month', cu.created_at AT TIME ZONE 'Europe/Istanbul') = g.m) AS credits
         FROM generate_series(date_trunc('month', now() AT TIME ZONE 'Europe/Istanbul') - interval '5 months', date_trunc('month', now() AT TIME ZONE 'Europe/Istanbul'), interval '1 month') AS g(m)
        ORDER BY g.m`)).rows;
    const recent = (await pool.query(
      `(SELECT 'uye' AS kind, COALESCE(NULLIF(name, ''), 'Yeni üye') AS text, NULL::bigint AS request_id, created_at FROM users ORDER BY created_at DESC LIMIT 8)
       UNION ALL (SELECT 'talep', title, id, created_at FROM requests ORDER BY created_at DESC LIMIT 8)
       UNION ALL (SELECT 'numara', r.title, r.id, cu.created_at FROM contact_unlocks cu JOIN requests r ON r.id = cu.request_id ORDER BY cu.created_at DESC LIMIT 8)
       UNION ALL (SELECT 'mesaj', r.title, r.id, m.created_at FROM messages m JOIN requests r ON r.id = m.request_id ORDER BY m.created_at DESC LIMIT 8)
       ORDER BY created_at DESC LIMIT 12`)).rows;
    return { totals, users_7d: users7, months, recent };
  });

  // Bütün talepler: arama ve duruma göre süzme; yönetici buradan yayından kaldırır ya da vitrine alır.
  app.get("/admin/requests", async (req) => {
    requireAdmin(req);
    const q = z.object({ q: z.string().trim().max(100).default(""), status: z.enum(["all", "active", "pending_review", "expired", "closed", "rejected"]).default("all"),
      page: z.coerce.number().int().min(1).max(500).default(1) }).parse(req.query);
    const where = ["($1 = '' OR r.title ILIKE '%' || $1 || '%' OR u.name ILIKE '%' || $1 || '%' OR r.id::text = $1)"];
    if (q.status === "active") where.push("r.status = 'active' AND r.expires_at > now()");
    else if (q.status === "expired") where.push("(r.status = 'expired' OR (r.status = 'active' AND r.expires_at <= now()))");
    else if (q.status !== "all") where.push(`r.status = '${q.status}'`);
    const { rows } = await pool.query(
      `SELECT r.id, r.title, r.status, r.created_at, r.expires_at, r.budget_max, r.city, r.district, r.is_urgent,
              coalesce(r.featured_until > now(), false) AS is_featured, u.name AS buyer_name, u.phone AS buyer_phone, u.email AS buyer_email,
              (SELECT count(*)::int FROM contact_unlocks cu WHERE cu.request_id = r.id) AS unlocks,
              (SELECT count(*)::int FROM messages m WHERE m.request_id = r.id) AS messages,
              count(*) OVER ()::int AS total
         FROM requests r JOIN users u ON u.id = r.buyer_id
        WHERE ${where.join(" AND ")} ORDER BY r.created_at DESC LIMIT 50 OFFSET $2`, [q.q, (q.page - 1) * 50]);
    return { items: rows.map(({ total: _t, ...x }) => x), total: rows[0]?.total ?? 0 };
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
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.credits, u.is_corporate, u.created_at,
              (SELECT count(*)::int FROM requests r WHERE r.buyer_id = u.id) AS requests,
              (SELECT count(*)::int FROM contact_unlocks cu WHERE cu.seller_id = u.id) AS unlocks
         FROM users u
        WHERE $1 = '' OR u.name ILIKE '%' || $1 || '%' OR u.email ILIKE '%' || $1 || '%' OR u.phone LIKE '%' || $1 || '%'
        ORDER BY u.created_at DESC LIMIT 50`, [q]);
    return { items: rows };
  });

  // Bildirim gönder: seçilen kitleye site içi bildirim (zil simgesinde görünür).
  app.post("/admin/notify", { config: { rateLimit: { max: 20, timeWindow: "1 hour" } } }, async (req) => {
    requireAdmin(req);
    const b = z.object({ text: z.string().trim().min(3, "Bildirim metnini yazın.").max(300), link: z.string().trim().max(300).regex(/^(\/|https:\/\/|$)/, "Bağlantı / veya https:// ile başlamalı.").default(""),
      audience: z.enum(["all", "buyers", "sellers"]) }).parse(req.body);
    const who = b.audience === "buyers" ? "WHERE EXISTS (SELECT 1 FROM requests r WHERE r.buyer_id = u.id)"
      : b.audience === "sellers" ? "WHERE EXISTS (SELECT 1 FROM contact_unlocks cu WHERE cu.seller_id = u.id) OR EXISTS (SELECT 1 FROM alarms a WHERE a.user_id = u.id)" : "";
    const r = await pool.query(`INSERT INTO notifications (user_id, text, link) SELECT u.id, $1, $2 FROM users u ${who}`, [b.text, b.link]);
    return { sent: r.rowCount ?? 0 };
  });

  // Entegrasyonlar: hangi dış hizmet bağlı (anahtarların kendisi asla gösterilmez).
  app.get("/admin/integrations", async (req) => {
    requireAdmin(req);
    const has = (...v: string[]) => v.every((x) => !!x.trim());
    return { items: [
      { key: "storage", name: "Fotoğraf ve video deposu (Cloudflare R2)", connected: deps.storage.enabled, note: "Fotoğraf/video yükleme" },
      { key: "ai", name: "Yapay zekâ (Anthropic Claude)", connected: has(config.ANTHROPIC_API_KEY), note: "Talebi otomatik doldurma ve içerik denetimi" },
      { key: "photos", name: "Ücretsiz fotoğraflar (Pixabay / Pexels)", connected: has(config.PIXABAY_API_KEY) || has(config.PEXELS_API_KEY), note: "Talebe uyan hazır görseller" },
      { key: "mail", name: "E-posta (Resend)", connected: has(config.RESEND_API_KEY), note: "E-postayla giriş kodu ve bildirimler" },
      { key: "sms", name: "SMS (Netgsm)", connected: has(config.NETGSM_USERCODE, config.NETGSM_PASSWORD, config.NETGSM_HEADER), note: "SMS ile giriş kodu ve talep alarmları" },
      { key: "google", name: "Google ile giriş", connected: has(config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET), note: "Tek tıkla giriş" },
      { key: "pay", name: "Ödeme (iyzico / PayTR)", connected: false, note: "Kredi satın alma (henüz bağlanmadı; kredi elle tanımlanıyor)" },
    ] };
  });

  // Üye listesi Excel'de açılacak CSV olarak (Türkçe karakterler için UTF-8 BOM, ayraç ;).
  app.get("/admin/users.csv", async (req, reply) => {
    requireAdmin(req);
    const { rows } = await pool.query(
      `SELECT u.name, u.email, u.phone, u.credits, u.is_corporate, u.created_at,
              (SELECT count(*)::int FROM requests r WHERE r.buyer_id = u.id) AS requests,
              (SELECT count(*)::int FROM contact_unlocks cu WHERE cu.seller_id = u.id) AS unlocks
         FROM users u ORDER BY u.created_at DESC`);
    const cell = (v: unknown) => { const t = v === null || v === undefined ? "" : String(v); return /[;"\n\r]/.test(t) || /^[=+\-@]/.test(t) ? `"${t.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : t; };
    const head = ["Ad Soyad", "E-posta", "Telefon", "Kredi", "Kurumsal", "Talep sayısı", "Açtığı numara", "Kayıt tarihi"];
    const lines = rows.map((r) => [r.name, r.email, r.phone, r.credits, r.is_corporate ? "Evet" : "Hayır", r.requests, r.unlocks,
      new Date(r.created_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })].map(cell).join(";"));
    reply.header("content-type", "text/csv; charset=utf-8").header("content-disposition", `attachment; filename="uyeler-${new Date().toISOString().slice(0, 10)}.csv"`);
    return "\uFEFF" + [head.join(";"), ...lines].join("\r\n");
  });

  // Kredi hareketleri: kim, ne zaman, neden kredi kazandı/harcadı.
  app.get("/admin/credits", async (req) => {
    requireAdmin(req);
    const { rows } = await pool.query(
      `SELECT l.id, l.delta, l.reason, l.created_at, u.name, u.phone, u.email
         FROM credit_ledger l JOIN users u ON u.id = l.user_id ORDER BY l.created_at DESC LIMIT 100`);
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
