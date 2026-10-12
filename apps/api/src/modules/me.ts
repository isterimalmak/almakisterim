import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser, type Deps } from "../context.js";
import { HttpError, idParam } from "../lib/util.js";
import { CITIES } from "../services/ai.js";
import { VISIBLE_CATEGORY_SQL } from "./categories.js";
import { freeUnlocksUsed, unlockSettings } from "./contacts.js";

export function meRoutes(app: FastifyInstance, { pool }: Deps) {
  app.get("/me", async (req) => {
    if (!req.user) return { user: null };
    const s = await unlockSettings(pool);
    const used = await freeUnlocksUsed(pool, req.user.id);
    const unread = (await pool.query<{ n: number }>("SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL", [req.user.id])).rows[0]!.n;
    return { user: { ...req.user, free_unlocks_left: Math.max(0, s.free - used), unlock_price: s.price, unread_notifications: unread } };
  });

  app.patch("/me", async (req) => {
    const user = requireUser(req);
    const b = z.object({ name: z.string().trim().min(2).max(80).optional(), is_corporate: z.boolean().optional() }).parse(req.body);
    await pool.query("UPDATE users SET name = COALESCE($2, name), is_corporate = COALESCE($3, is_corporate) WHERE id = $1",
      [user.id, b.name ?? null, b.is_corporate ?? null]);
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

  // Satıcıya uygun talepler: alarm kurduğu kategoriler ve iller.
  app.get("/me/matches", async (req) => {
    const user = requireUser(req);
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (r.id) r.id, r.title, r.budget_min, r.budget_max, r.city, r.created_at, c.name AS category_name,
              (SELECT count(*)::int FROM offers o WHERE o.request_id = r.id AND o.status <> 'withdrawn') AS offer_count,
              EXISTS (SELECT 1 FROM offers o WHERE o.request_id = r.id AND o.seller_id = $1) AS already_offered
         FROM alarms a
         JOIN categories c ON (c.id = a.category_id OR c.parent_id = a.category_id)
         LEFT JOIN categories p ON p.id = c.parent_id
         JOIN requests r ON r.category_id = c.id
        WHERE a.user_id = $1 AND r.buyer_id <> $1 AND r.status = 'active' AND r.expires_at > now()
          AND (a.city = '' OR a.city = r.city) AND r.budget_max >= a.min_budget AND ${VISIBLE_CATEGORY_SQL}
        ORDER BY r.id DESC LIMIT 100`, [user.id]);
    return { items: rows };
  });

  app.get("/me/alarms", async (req) => {
    const user = requireUser(req);
    const { rows } = await pool.query(
      `SELECT a.id, a.category_id, c.name AS category_name, a.city, a.min_budget, a.created_at
         FROM alarms a JOIN categories c ON c.id = a.category_id WHERE a.user_id = $1 ORDER BY a.created_at DESC`, [user.id]);
    return { items: rows };
  });

  app.post("/me/alarms", async (req, reply) => {
    const user = requireUser(req);
    const b = z.object({
      category_id: z.string(), city: z.string().default("").refine((c) => c === "" || CITIES.includes(c), "Geçerli bir il seçin."),
      min_budget: z.number().int().min(0).default(0),
    }).parse(req.body);
    const count = (await pool.query<{ n: number }>("SELECT count(*)::int AS n FROM alarms WHERE user_id = $1", [user.id])).rows[0]!.n;
    if (count >= 20) throw new HttpError(400, "alarm_siniri", "En fazla 20 alarm kurabilirsiniz.");
    const cat = await pool.query("SELECT 1 FROM categories WHERE id = $1", [b.category_id]);
    if (!cat.rowCount) throw new HttpError(400, "kategori_gecersiz", "Kategori bulunamadı.");
    const { rows } = await pool.query<{ id: number }>("INSERT INTO alarms (user_id, category_id, city, min_budget) VALUES ($1,$2,$3,$4) RETURNING id",
      [user.id, b.category_id, b.city, b.min_budget]);
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
