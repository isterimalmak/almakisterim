import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin, type Deps } from "../context.js";
import { tx } from "../db.js";
import { HttpError } from "../lib/util.js";
import { toPublic } from "./media.js";

// Reklam alanları: yönetici resim veya video yükler, ana sayfada sol sütunda alt alta, sıralı gösterilir.
type AdRow = { id: number; title: string; link_url: string | null; position: number; is_active: boolean; created_at: string;
  media_id: string; kind: "image" | "video"; content_type: string; storage_key: string };

// Boş bırakılırsa bağlantısız reklam.
const Link = z.preprocess((v) => (typeof v === "string" && !v.trim() ? null : v),
  z.string().trim().max(500).regex(/^(https?:\/\/|\/)/, "Bağlantı https:// veya / ile başlamalı.").nullable().optional());
const Title = z.string().trim().max(120).optional();

const SELECT = `SELECT a.id, a.title, a.link_url, a.position, a.is_active, a.created_at, m.id AS media_id, m.kind, m.content_type, m.storage_key
  FROM ads a JOIN media m ON m.id = a.media_id`;

export function adRoutes(app: FastifyInstance, deps: Deps) {
  const { pool, storage } = deps;
  const out = (a: AdRow) => ({ id: Number(a.id), title: a.title, link_url: a.link_url, position: a.position, is_active: a.is_active,
    created_at: a.created_at, media: toPublic(storage, { id: a.media_id, kind: a.kind, content_type: a.content_type, storage_key: a.storage_key }) });

  // Önbelleğe alınmaz: yönetici eklediği reklamı hemen görsün.
  app.get("/tanitim", async () => {
    const { rows } = await pool.query<AdRow>(`${SELECT} WHERE a.is_active AND a.placement = 'sol' ORDER BY a.position, a.id`);
    return { items: rows.map(out).map(({ is_active: _a, position: _p, created_at: _c, ...x }) => x) };
  });

  app.get("/admin/tanitim", async (req) => {
    requireAdmin(req);
    const { rows } = await pool.query<AdRow>(`${SELECT} ORDER BY a.position, a.id`);
    return { items: rows.map(out) };
  });

  // Yönetici önce dosyayı normal yükleme akışıyla yükler (/media/uploads → /complete), sonra reklam olarak ekler.
  app.post("/admin/tanitim", async (req, reply) => {
    const admin = requireAdmin(req);
    const b = z.object({ media_id: z.uuid(), title: Title, link_url: Link, is_active: z.boolean().default(true) }).parse(req.body);
    const id = await tx(pool, async (c) => {
      const m = (await c.query("SELECT 1 FROM media WHERE id = $1 AND owner_id = $2 AND status = 'ready' AND request_id IS NULL AND offer_id IS NULL FOR UPDATE", [b.media_id, admin.id])).rowCount;
      if (!m) throw new HttpError(400, "medya_gecersiz", "Dosya bulunamadı. Lütfen yeniden yükleyin.");
      if ((await c.query("SELECT 1 FROM ads WHERE media_id = $1", [b.media_id])).rowCount) throw new HttpError(409, "zaten_ekli", "Bu dosya zaten bir reklamda kullanılıyor.");
      const r = await c.query<{ id: number }>(
        "INSERT INTO ads (media_id, title, link_url, is_active, position) VALUES ($1, $2, $3, $4, (SELECT coalesce(max(position), 0) + 1 FROM ads)) RETURNING id",
        [b.media_id, b.title ?? "", b.link_url ?? null, b.is_active]);
      return Number(r.rows[0]!.id);
    });
    reply.code(201);
    const { rows } = await pool.query<AdRow>(`${SELECT} WHERE a.id = $1`, [id]);
    return out(rows[0]!);
  });

  app.patch("/admin/tanitim/:id", async (req) => {
    requireAdmin(req);
    const { id } = z.object({ id: z.coerce.number().int() }).parse(req.params);
    const b = z.object({ title: Title, link_url: Link, is_active: z.boolean().optional() }).parse(req.body);
    const sets: string[] = [], params: unknown[] = [id];
    if (b.title !== undefined) { params.push(b.title); sets.push(`title = $${params.length}`); }
    if (b.link_url !== undefined) { params.push(b.link_url); sets.push(`link_url = $${params.length}`); }
    if (b.is_active !== undefined) { params.push(b.is_active); sets.push(`is_active = $${params.length}`); }
    if (sets.length) {
      const r = await pool.query(`UPDATE ads SET ${sets.join(", ")} WHERE id = $1`, params);
      if (!r.rowCount) throw new HttpError(404, "bulunamadi", "Reklam bulunamadı.");
    }
    const { rows } = await pool.query<AdRow>(`${SELECT} WHERE a.id = $1`, [id]);
    if (!rows[0]) throw new HttpError(404, "bulunamadi", "Reklam bulunamadı.");
    return out(rows[0]);
  });

  // Sıralama: yönetici yukarı/aşağı oklarla değiştirir, tüm sıra gönderilir.
  app.post("/admin/tanitim/order", async (req) => {
    requireAdmin(req);
    const { ids } = z.object({ ids: z.array(z.number().int()).max(500) }).parse(req.body);
    await pool.query("UPDATE ads a SET position = x.pos FROM unnest($1::bigint[]) WITH ORDINALITY AS x(id, pos) WHERE a.id = x.id", [ids]);
    return { ok: true };
  });

  app.delete("/admin/tanitim/:id", async (req) => {
    requireAdmin(req);
    const { id } = z.object({ id: z.coerce.number().int() }).parse(req.params);
    const r = await pool.query<{ storage_key: string }>(
      "DELETE FROM media WHERE id = (SELECT media_id FROM ads WHERE id = $1) RETURNING storage_key", [id]);
    if (!r.rowCount) throw new HttpError(404, "bulunamadi", "Reklam bulunamadı.");
    await storage.remove(r.rows[0]!.storage_key).catch((e) => req.log.warn({ err: (e as Error).message }, "dosya silinemedi"));
    return { ok: true };
  });
}
