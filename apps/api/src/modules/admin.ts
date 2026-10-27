import { safeJobs } from "./safe.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin, type Deps } from "../context.js";
import { tx } from "../db.js";
import { HttpError, normalizeEmail, normalizePhone, safeEqual } from "../lib/util.js";
import { listCategories, toTree } from "./categories.js";
import { cleanupOrphans, mediaFor } from "./media.js";
import { expiryReminders, notifyAlarmMatches, requestStatusEmail } from "./notifications.js";
import { autoBlog, recheckHeld } from "./ai-admin.js";
import { mailEvent, mailTick } from "./mailstudio.js";

// Ana sayfanın orta sütunundaki bölümler (web/app/page.tsx ile aynı adlar).
const HOME_SECTIONS = ["hero", "urgent", "cats", "ads_m", "center_ads", "vitrin", "latest", "corp"] as const;

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
    if (p.action !== "remove") void requestStatusEmail(deps, p.id).catch(() => {});
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
      publish_sms: z.boolean().optional(),
      home_urgent_box: z.boolean().optional(),
      site_name: z.string().trim().min(2, "Site adı en az 2 karakter olmalı.").max(40).optional(),
      home_vitrin: z.boolean().optional(),
      home_latest: z.boolean().optional(),
      home_order: z.array(z.enum(HOME_SECTIONS)).max(HOME_SECTIONS.length).optional(),
      home_hidden: z.array(z.enum(HOME_SECTIONS)).max(HOME_SECTIONS.length).optional(),
      photo_required: z.boolean().optional(),
      // Ödeme bölümlerinin sitede görünmesi (Güvenli Al, kredi ve mağaza)
      show_safe: z.boolean().optional(),
      show_credits: z.boolean().optional(),
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

  // Üye kartı: bilgiler, yöneticinin yaptığı değişiklikler ve üyenin kendi numara değişiklikleri.
  app.get("/admin/users/:id", async (req) => {
    requireAdmin(req);
    const id = z.string().uuid().parse((req.params as { id: string }).id);
    const user = (await pool.query(
      `SELECT id, name, email, phone, role, credits, is_corporate, created_at, deleted_at,
              google_sub IS NOT NULL AS google, apple_sub IS NOT NULL AS apple FROM users WHERE id = $1`, [id])).rows[0];
    if (!user) throw new HttpError(404, "bulunamadi", "Üye bulunamadı.");
    const edits = (await pool.query(
      `SELECT e.id, e.field, e.old_value, e.new_value, e.note, e.created_at, a.name AS admin_name
         FROM user_edits e LEFT JOIN users a ON a.id = e.admin_id WHERE e.user_id = $1 ORDER BY e.id DESC LIMIT 50`, [id])).rows;
    const phoneChanges = (await pool.query(
      `SELECT old_phone, new_phone, identity_via, completed_at FROM phone_changes
        WHERE user_id = $1 AND completed_at IS NOT NULL ORDER BY id DESC LIMIT 20`, [id])).rows;
    return { user, edits, phone_changes: phoneChanges };
  });

  // Üye bilgilerini düzeltme (ad, e-posta, telefon, kurumsal). Her değişiklik nedeniyle ve yöneticinin adıyla kaydedilir;
  // e-posta ya da telefon değişirse eski adrese/numaraya bilgi gider (hesap ele geçirme girişimi fark edilsin).
  const FIELD_TR = { name: "Ad soyad", email: "E-posta", phone: "Telefon", is_corporate: "Kurumsal" } as const;
  app.patch("/admin/users/:id", { config: { rateLimit: { max: 60, timeWindow: "1 hour" } } }, async (req) => {
    const admin = requireAdmin(req);
    const id = z.string().uuid().parse((req.params as { id: string }).id);
    const b = z.object({
      name: z.string().trim().min(2, "Ad en az 2 karakter olmalı.").max(80).optional(),
      email: z.string().trim().max(254).optional(), // boş = e-postayı kaldır
      phone: z.string().trim().max(30).optional(), // boş = numarayı kaldır
      is_corporate: z.boolean().optional(),
      note: z.string().trim().min(5, "Değişikliğin nedenini yazın (ör. kimlik belgesiyle başvurdu).").max(300),
      logout: z.boolean().default(false),
    }).parse(req.body);
    const cur = (await pool.query<{ name: string; email: string | null; phone: string | null; is_corporate: boolean; deleted_at: string | null; google: boolean; apple: boolean }>(
      "SELECT name, email, phone, is_corporate, deleted_at, google_sub IS NOT NULL AS google, apple_sub IS NOT NULL AS apple FROM users WHERE id = $1", [id])).rows[0];
    if (!cur) throw new HttpError(404, "bulunamadi", "Üye bulunamadı.");
    if (cur.deleted_at) throw new HttpError(400, "silinmis", "Silinmiş hesap düzenlenemez.");

    const next = { name: cur.name, email: cur.email, phone: cur.phone, is_corporate: cur.is_corporate };
    if (b.name !== undefined) next.name = b.name;
    if (b.email !== undefined) {
      next.email = b.email === "" ? null : normalizeEmail(b.email);
      if (b.email !== "" && !next.email) throw new HttpError(400, "gecersiz_eposta", "Geçerli bir e-posta adresi yazın.");
    }
    if (b.phone !== undefined) {
      next.phone = b.phone === "" ? null : normalizePhone(b.phone);
      if (b.phone !== "" && !next.phone) throw new HttpError(400, "gecersiz_numara", "Geçerli bir cep telefonu numarası yazın.");
    }
    if (b.is_corporate !== undefined) next.is_corporate = b.is_corporate;
    const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => next[k] !== cur[k]);
    if (!changed.length) throw new HttpError(400, "degisiklik_yok", "Herhangi bir bilgi değişmedi.");
    if (!next.email && !next.phone && !cur.google && !cur.apple)
      throw new HttpError(400, "iletisim_gerekli", "Üyenin giriş yapabilmesi için e-posta ya da telefondan birini bırakın.");
    if (changed.includes("email") && next.email && (await pool.query("SELECT 1 FROM users WHERE email = $1 AND id <> $2", [next.email, id])).rowCount)
      throw new HttpError(409, "eposta_kullanimda", "Bu e-posta adresi başka bir hesaba bağlı.");
    if (changed.includes("phone") && next.phone && (await pool.query("SELECT 1 FROM users WHERE phone = $1 AND id <> $2", [next.phone, id])).rowCount)
      throw new HttpError(409, "numara_kullanimda", "Bu numara başka bir hesaba bağlı.");

    const show = (k: keyof typeof next, v: unknown) => k === "is_corporate" ? (v ? "Evet" : "Hayır") : (v as string | null);
    await tx(pool, async (c) => {
      await c.query("UPDATE users SET name = $2, email = $3, phone = $4, is_corporate = $5 WHERE id = $1", [id, next.name, next.email, next.phone, next.is_corporate]);
      for (const k of changed)
        await c.query("INSERT INTO user_edits (user_id, admin_id, field, old_value, new_value, note) VALUES ($1,$2,$3,$4,$5,$6)",
          [id, admin.id, k, show(k, cur[k]), show(k, next[k]), b.note]);
      if (b.logout) await c.query("DELETE FROM sessions WHERE user_id = $1", [id]);
    });

    const notice = (what: string) => `almakisterim hesabınızın ${what} destek ekibimiz tarafından değiştirildi. Bu değişikliği siz istemediyseniz hemen destek@almakisterim.com adresine yazın.`;
    if (changed.includes("phone") && cur.phone) void deps.sms.send(cur.phone, notice("telefon numarası")).catch(() => {});
    if (changed.includes("email") && cur.email) void deps.mailer.send(cur.email, "Hesap bilgileriniz değiştirildi", notice("e-posta adresi"), { critical: true }).catch(() => {});
    return { ok: true, changed: changed.map((k) => FIELD_TR[k]) };
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
    const r = await pool.query<{ id: number; buyer_id: string }>("UPDATE requests SET status = 'expired' WHERE status = 'active' AND expires_at <= now() RETURNING id, buyer_id");
    // E-posta Stüdyosu: "Talebin süresi dolunca" görevleri sıraya girer
    for (const x of r.rows) await mailEvent(pool, "request_expired", x.buyer_id, x.id);
    const s = await pool.query("DELETE FROM sessions WHERE expires_at <= now()");
    const c = await pool.query("DELETE FROM auth_codes WHERE created_at < now() - interval '2 days'");
    const m = await cleanupOrphans(pool, deps.storage);
    // Süresi dolmak üzere olan talepler için hatırlatma; otomatik blog açıksa sırası gelen yazı.
    const reminded = await expiryReminders(deps).catch(() => 0);
    const blog = await autoBlog(deps).catch((e) => { req.log.warn({ err: (e as Error).message }, "otomatik blog yazılamadı"); return null; });
    // Yapay zekâ çalışmadığı için bekletilen talepler yeniden denetlenir; uygunsa yayına alınır, sahibine haber gider.
    const recheck = await recheckHeld(deps).catch((e) => { req.log.warn({ err: (e as Error).message }, "yeniden denetim yapılamadı"); return { checked: 0, published: 0 }; });
    // Güvenli Al: onay süresi dolan kargolar tamamlanır, kargolanmayanlar iade edilir.
    const safe = await safeJobs(deps).catch((e) => { req.log.warn({ err: (e as Error).message }, "güvenli al işleri yapılamadı"); return null; });
    // E-posta Stüdyosu: tarihi gelen kampanyalar, talep vermeyen hatırlatmaları ve vakti gelen gönderimler
    const mail = await mailTick(deps, req.log).catch((e) => { req.log.warn({ err: (e as Error).message }, "e-posta işi yapılamadı"); return null; });
    return { safe, mail, expired: r.rowCount, sessions_removed: s.rowCount, codes_removed: c.rowCount, media_removed: m, reminded, blog: blog?.slug ?? null, rechecked: recheck };
  });
}
