import type { FastifyInstance } from "fastify";
import { requireUser, type Deps } from "../context.js";
import { tx, type Client, type Pool } from "../db.js";
import { HttpError, idParam } from "../lib/util.js";

// Gelir modeli: satıcı, alıcının numarasını görmek için kredi harcar. Numarayı açan satıcı teklif de verebilir.
export type UnlockSettings = { free: number; price: number; priceByTop: Record<string, number>; limit: number };

export async function unlockSettings(db: Pool | Client): Promise<UnlockSettings> {
  const { rows } = await db.query<{ key: string; value: unknown }>(
    "SELECT key, value FROM settings WHERE key IN ('free_unlocks_per_month','unlock_price_credits','unlock_price_by_top','unlock_limit_per_request')");
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    free: Number(s.free_unlocks_per_month ?? 0),
    price: Number(s.unlock_price_credits ?? 1),
    priceByTop: (s.unlock_price_by_top as Record<string, number>) ?? {},
    limit: Number(s.unlock_limit_per_request ?? 10),
  };
}

export const priceFor = (s: UnlockSettings, top: string) => Number(s.priceByTop[top] ?? s.price);

// Ayın başından beri (Türkiye saatiyle) kullanılan ücretsiz numara görme hakkı.
export async function freeUnlocksUsed(db: Pool | Client, userId: string) {
  return (await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM contact_unlocks
      WHERE seller_id = $1 AND is_free
        AND created_at >= date_trunc('month', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul'`, [userId])).rows[0]!.n;
}

export function contactRoutes(app: FastifyInstance, deps: Deps) {
  const { pool } = deps;

  app.post("/requests/:id/unlock", { config: { rateLimit: { max: 60, timeWindow: "1 hour" } } }, async (req, reply) => {
    const user = requireUser(req);
    const id = idParam(req.params);
    const out = await tx(pool, async (c) => {
      const r = (await c.query<{ buyer_id: string; status: string; open: boolean; phone: string | null; top_id: string }>(
        `SELECT r.buyer_id, r.status, r.expires_at > now() AS open, u.phone, cat.parent_id AS top_id
           FROM requests r JOIN users u ON u.id = r.buyer_id JOIN categories cat ON cat.id = r.category_id
          WHERE r.id = $1 FOR UPDATE OF r`, [id])).rows[0];
      if (!r) throw new HttpError(404, "bulunamadi", "Talep bulunamadı.");
      if (r.buyer_id === user.id) throw new HttpError(400, "kendi_talebi", "Kendi talebinizin numarasını açamazsınız.");
      const prev = await c.query("SELECT 1 FROM contact_unlocks WHERE request_id = $1 AND seller_id = $2", [id, user.id]);
      if (prev.rowCount) return { phone: r.phone, charged: 0, free: false, already: true };
      if (r.status !== "active" || !r.open) throw new HttpError(409, "talep_kapali", "Bu talep artık yeni satıcı kabul etmiyor.");
      if (!r.phone) throw new HttpError(409, "numara_yok", "Bu alıcının doğrulanmış telefon numarası yok.");

      const s = await unlockSettings(c);
      const count = (await c.query<{ n: number }>("SELECT count(*)::int AS n FROM contact_unlocks WHERE request_id = $1", [id])).rows[0]!.n;
      if (s.limit > 0 && count >= s.limit) throw new HttpError(409, "sinir_doldu", `Bu talepte numarayı görebilecek satıcı sayısı (${s.limit}) doldu.`);

      const price = priceFor(s, r.top_id);
      let free = false, charged = 0;
      if (price === 0) {
        free = true;
      } else if ((await freeUnlocksUsed(c, user.id)) < s.free) {
        free = true;
      } else {
        const paid = await c.query("UPDATE users SET credits = credits - $2 WHERE id = $1 AND credits >= $2 RETURNING credits", [user.id, price]);
        if (!paid.rowCount) throw new HttpError(402, "kredi_yok", `Numarayı görmek için ${price} kredi gerekiyor. Kredi yükleyin.`);
        charged = price;
      }
      await c.query("INSERT INTO contact_unlocks (request_id, seller_id, credits, is_free) VALUES ($1,$2,$3,$4)", [id, user.id, charged, free]);
      if (charged) await c.query("INSERT INTO credit_ledger (user_id, delta, reason, ref) VALUES ($1, $2, 'numara', $3)", [user.id, -charged, `request:${id}`]);
      return { phone: r.phone, charged, free, already: false };
    });
    if (!out.already) reply.code(201);
    return { phone: out.phone, charged_credits: out.charged, free: out.free };
  });
}
