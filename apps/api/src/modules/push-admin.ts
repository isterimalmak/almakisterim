import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin, type Deps } from "../context.js";
import { HttpError } from "../lib/util.js";
import { deliver } from "../services/push.js";

// Yönetim → Uygulama Bildirimleri: telefon uygulamasını kullanan üyelere duyuru bildirimi.
// Önce "Kendime dene" ile yöneticinin kendi telefonuna gönderilir; duyuruları kapatan üyelere ("news") gitmez.
const AUDIENCES = {
  all: "TRUE",
  buyers: "EXISTS (SELECT 1 FROM requests r WHERE r.buyer_id = u.id)",
  sellers: "(EXISTS (SELECT 1 FROM contact_unlocks x WHERE x.seller_id = u.id) OR EXISTS (SELECT 1 FROM offers o WHERE o.seller_id = u.id) OR EXISTS (SELECT 1 FROM alarms a WHERE a.user_id = u.id))",
} as const;
type Audience = keyof typeof AUDIENCES | "test";

const targetSql = (a: keyof typeof AUDIENCES) =>
  `FROM push_tokens t JOIN users u ON u.id = t.user_id
    WHERE u.deleted_at IS NULL AND coalesce((u.push_prefs->>'news')::boolean, true) AND ${AUDIENCES[a]}`;

export function pushAdminRoutes(app: FastifyInstance, deps: Deps) {
  const { pool } = deps;

  app.get("/admin/push", async (req) => {
    requireAdmin(req);
    const devices = (await pool.query<{ platform: string; n: number }>("SELECT platform, count(*)::int AS n FROM push_tokens GROUP BY platform")).rows;
    const audiences: Record<string, { users: number; devices: number }> = {};
    for (const a of Object.keys(AUDIENCES) as (keyof typeof AUDIENCES)[]) {
      audiences[a] = (await pool.query<{ users: number; devices: number }>(`SELECT count(DISTINCT u.id)::int AS users, count(*)::int AS devices ${targetSql(a)}`)).rows[0]!;
    }
    const mine = (await pool.query<{ n: number }>("SELECT count(*)::int AS n FROM push_tokens WHERE user_id = $1", [req.user!.id])).rows[0]!.n;
    const campaigns = (await pool.query(
      `SELECT c.id, c.title, c.body, c.link, c.audience, c.recipients, c.devices, c.delivered, c.failed, c.created_at, u.name AS created_by
         FROM push_campaigns c LEFT JOIN users u ON u.id = c.created_by ORDER BY c.id DESC LIMIT 30`)).rows;
    return {
      devices: { ios: devices.find((d) => d.platform === "ios")?.n ?? 0, android: devices.find((d) => d.platform === "android")?.n ?? 0 },
      audiences, my_devices: mine, campaigns,
    };
  });

  app.post("/admin/push/send", { config: { rateLimit: { max: 30, timeWindow: "1 hour" } } }, async (req, reply) => {
    const admin = requireAdmin(req);
    const b = z.object({
      title: z.string().trim().min(2, "Başlık en az 2 karakter olmalı.").max(60, "Başlık en fazla 60 karakter olabilir."),
      body: z.string().trim().min(5, "Metin en az 5 karakter olmalı.").max(180, "Metin en fazla 180 karakter olabilir."),
      // Bildirime dokununca açılacak sayfa: site içi adres (/kategori/vasita gibi) ya da boş (ana sayfa).
      link: z.string().trim().max(200).regex(/^(\/[^\s]*)?$/, "Bağlantı / ile başlayan bir site adresi olmalı (ör. /talep-ver).").default(""),
      audience: z.enum(["test", "all", "buyers", "sellers"]),
    }).parse(req.body);
    const audience = b.audience as Audience;
    const rows = audience === "test"
      ? (await pool.query<{ token: string; user_id: string }>("SELECT token, user_id FROM push_tokens WHERE user_id = $1", [admin.id])).rows
      : (await pool.query<{ token: string; user_id: string }>(`SELECT t.token, t.user_id ${targetSql(audience)}`)).rows;
    if (!rows.length) {
      throw new HttpError(409, "cihaz_yok", audience === "test"
        ? "Telefonunuzda bildirim açık değil. Uygulamada bu hesapla giriş yapıp bildirim iznine \"İzin ver\" deyin, sonra yeniden deneyin."
        : "Bu gruptaki hiçbir üyenin telefonunda bildirim açık değil.");
    }
    const r = await deliver(pool, rows.map((x) => x.token), b.title, b.body, b.link);
    const recipients = new Set(rows.map((x) => x.user_id)).size;
    const { rows: [c] } = await pool.query(
      `INSERT INTO push_campaigns (title, body, link, audience, recipients, devices, delivered, failed, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, recipients, devices, delivered, failed`,
      [b.title, b.body, b.link, audience, recipients, r.devices, r.delivered, r.failed, admin.id]);
    reply.code(201);
    return c;
  });
}
