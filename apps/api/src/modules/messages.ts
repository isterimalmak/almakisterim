import { aiSettings, logAiAction } from "../services/ai-guard.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser, type Deps } from "../context.js";
import type { Pool } from "../db.js";
import { HttpError, publicName } from "../lib/util.js";
import { notify } from "./contacts.js";

// Mesajlaşma: satıcı, iletişimini açtığı (numara gör) talebin sahibine yazar; alıcı cevap verir.
// Konuşma anahtarı (talep, satıcı). Alıcı satıcıyı şikâyet ettiyse (iletişim geri alındıysa) satıcı yazamaz.

type Msg = { id: number; sender_id: string; body: string; created_at: string; read_at: string | null };
const Body = z.object({ body: z.string().trim().min(1, "Mesaj boş olamaz.").max(2000), seller_id: z.uuid().optional() });

export async function unreadMessages(pool: Pool, userId: string) {
  return (await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM messages m JOIN requests r ON r.id = m.request_id
      WHERE m.read_at IS NULL AND m.sender_id <> $1 AND (m.seller_id = $1 OR r.buyer_id = $1)`, [userId])).rows[0]!.n;
}

export function messageRoutes(app: FastifyInstance, deps: Deps) {
  const { pool } = deps;
  const thread = async (requestId: number, sellerId: string, viewerId: string) => {
    const { rows } = await pool.query<Msg>(
      "SELECT id, sender_id, body, created_at, read_at FROM messages WHERE request_id = $1 AND seller_id = $2 ORDER BY created_at, id", [requestId, sellerId]);
    await pool.query("UPDATE messages SET read_at = now() WHERE request_id = $1 AND seller_id = $2 AND sender_id <> $3 AND read_at IS NULL", [requestId, sellerId, viewerId]);
    return rows.map((m) => ({ id: Number(m.id), mine: m.sender_id === viewerId, body: m.body, created_at: m.created_at, read: !!m.read_at }));
  };
  const request = async (id: number) => {
    const r = (await pool.query<{ buyer_id: string; title: string }>("SELECT buyer_id, title FROM requests WHERE id = $1", [id])).rows[0];
    if (!r) throw new HttpError(404, "bulunamadi", "Talep bulunamadı.");
    return r;
  };
  const sellerAccess = async (id: number, sellerId: string) =>
    (await pool.query<{ revoked: boolean }>("SELECT revoked_at IS NOT NULL AS revoked FROM contact_unlocks WHERE request_id = $1 AND seller_id = $2", [id, sellerId])).rows[0];

  // Talep sayfası: satıcı kendi konuşmasını, alıcı gelen bütün konuşmaları görür.
  app.get("/requests/:id/messages", async (req) => {
    const user = requireUser(req);
    const { id } = z.object({ id: z.coerce.number().int() }).parse(req.params);
    const r = await request(id);
    if (r.buyer_id !== user.id) {
      const acc = await sellerAccess(id, user.id);
      return { can_write: !!acc && !acc.revoked, messages: acc ? await thread(id, user.id, user.id) : [] };
    }
    const sellers = (await pool.query<{ seller_id: string; name: string; last: string }>(
      `SELECT m.seller_id, u.name, max(m.created_at) AS last FROM messages m JOIN users u ON u.id = m.seller_id
        WHERE m.request_id = $1 GROUP BY m.seller_id, u.name ORDER BY last DESC`, [id])).rows;
    const threads = [];
    for (const s of sellers) {
      const acc = await sellerAccess(id, s.seller_id);
      threads.push({ seller_id: s.seller_id, seller_name: publicName(s.name), blocked: !!acc?.revoked, messages: await thread(id, s.seller_id, user.id) });
    }
    return { threads };
  });

  app.post("/requests/:id/messages", { config: { rateLimit: { max: 60, timeWindow: "1 hour" } } }, async (req, reply) => {
    const user = requireUser(req);
    const { id } = z.object({ id: z.coerce.number().int() }).parse(req.params);
    const b = Body.parse(req.body);
    const r = await request(id);
    let sellerId: string;
    if (r.buyer_id === user.id) {
      // Alıcı yalnızca kendisine yazmış satıcıya cevap verir.
      if (!b.seller_id) throw new HttpError(400, "satici_gerekli", "Kime cevap verdiğinizi seçin.");
      const has = (await pool.query("SELECT 1 FROM messages WHERE request_id = $1 AND seller_id = $2 LIMIT 1", [id, b.seller_id])).rowCount;
      if (!has) throw new HttpError(404, "konusma_yok", "Bu satıcıyla bir konuşmanız yok.");
      sellerId = b.seller_id;
    } else {
      const acc = await sellerAccess(id, user.id);
      if (!acc) throw new HttpError(402, "iletisim_acilmadi", "Mesaj göndermek için önce alıcıyla iletişimi açın.");
      if (acc.revoked) throw new HttpError(403, "engellendi", "Alıcı sizinle iletişimi durdurdu.");
      sellerId = user.id;
    }
    // Küfür, hakaret, tehdit veya dolandırıcılık içeren mesaj karşı tarafa iletilmez.
    if ((await aiSettings(pool)).messages) {
      const chk = await deps.ai.checkMessage(b.body);
      if (chk.verdict === "block") {
        await logAiAction(pool, { kind: "mesaj_engel", target: id, summary: `Mesaj iletilmedi (${chk.reason}): "${b.body.slice(0, 120)}"` });
        throw new HttpError(400, "mesaj_uygunsuz", `Mesajınız gönderilmedi${chk.reason ? `: ${chk.reason}` : ""}. Lütfen saygılı bir dille yazın; ürünü görmeden ödeme istemeyin.`);
      }
    }
    const { rows } = await pool.query<{ id: number; created_at: string }>(
      "INSERT INTO messages (request_id, seller_id, sender_id, body) VALUES ($1, $2, $3, $4) RETURNING id, created_at", [id, sellerId, user.id, b.body]);
    const to = r.buyer_id === user.id ? sellerId : r.buyer_id;
    await notify(pool, to, `"${r.title}" talebi için yeni mesajınız var.`, `/talep/${id}#mesajlar`);
    reply.code(201);
    return { id: Number(rows[0]!.id), mine: true, body: b.body, created_at: rows[0]!.created_at, read: false };
  });

  // Bana Özel → Mesajlar: alıcı ve satıcı olarak bütün konuşmalar, en yeni önce.
  app.get("/me/messages", async (req) => {
    const user = requireUser(req);
    const { rows } = await pool.query<{ request_id: number; title: string; seller_id: string; buyer_id: string; other_name: string; body: string; last: string; unread: number }>(
      `SELECT DISTINCT ON (m.request_id, m.seller_id) m.request_id, r.title, m.seller_id, r.buyer_id,
              CASE WHEN r.buyer_id = $1 THEN s.name ELSE b.name END AS other_name, m.body, m.created_at AS last,
              (SELECT count(*)::int FROM messages x WHERE x.request_id = m.request_id AND x.seller_id = m.seller_id AND x.sender_id <> $1 AND x.read_at IS NULL) AS unread
         FROM messages m JOIN requests r ON r.id = m.request_id JOIN users s ON s.id = m.seller_id JOIN users b ON b.id = r.buyer_id
        WHERE m.seller_id = $1 OR r.buyer_id = $1
        ORDER BY m.request_id, m.seller_id, m.created_at DESC`, [user.id]);
    const items = rows.map((x) => ({ request_id: Number(x.request_id), title: x.title, role: x.buyer_id === user.id ? "alici" : "satici", other_name: publicName(x.other_name),
      last_body: x.body.slice(0, 140), last_at: x.last, unread: x.unread }));
    items.sort((a, b) => +new Date(b.last_at) - +new Date(a.last_at));
    return { items };
  });
}
