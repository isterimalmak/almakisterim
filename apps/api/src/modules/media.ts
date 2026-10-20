import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser, type Deps } from "../context.js";
import type { Client, Pool } from "../db.js";
import { HttpError } from "../lib/util.js";
import { MemoryStorage, type MediaStorage } from "../services/storage.js";

// İzin verilen türler: tarayıcıların hepsinde gösterilebilenler.
export const MEDIA_TYPES: Record<string, { kind: "image" | "video"; ext: string }> = {
  "image/jpeg": { kind: "image", ext: "jpg" },
  "image/png": { kind: "image", ext: "png" },
  "image/webp": { kind: "image", ext: "webp" },
  "video/mp4": { kind: "video", ext: "mp4" },
  "video/quicktime": { kind: "video", ext: "mov" },
  "video/webm": { kind: "video", ext: "webm" },
};
export const MAX_BYTES = { image: 10 * 1024 * 1024, video: 100 * 1024 * 1024 } as const;
// Bir talep veya teklif başına.
export const MAX_PER_ITEM = { image: 8, video: 1 } as const;
const DAILY_UPLOADS = 100;

export type PublicMedia = { id: string; kind: "image" | "video"; content_type: string; url: string };
type MediaRow = { id: string; kind: "image" | "video"; content_type: string; storage_key: string; owner_id: string; status: string; request_id: number | null; offer_id: number | null; size_bytes: number };

export const toPublic = (s: MediaStorage, m: Pick<MediaRow, "id" | "kind" | "content_type" | "storage_key">): PublicMedia =>
  ({ id: m.id, kind: m.kind, content_type: m.content_type, url: s.publicUrl(m.storage_key) });

export const MediaIds = z.array(z.uuid()).max(MAX_PER_ITEM.image + MAX_PER_ITEM.video).default([]);

// Kullanıcının yüklediği hazır dosyaları talebe veya teklife bağlar. İşlem (transaction) içinde çağrılır.
export async function attachMedia(c: Client, ownerId: string, ids: string[], target: { request_id: number } | { offer_id: number }) {
  if (!ids.length) return;
  if (new Set(ids).size !== ids.length) throw new HttpError(400, "medya_gecersiz", "Aynı dosya birden fazla eklenemez.");
  const { rows } = await c.query<MediaRow>("SELECT * FROM media m WHERE id = ANY($1::uuid[]) AND NOT EXISTS (SELECT 1 FROM ads a WHERE a.media_id = m.id) FOR UPDATE", [ids]);
  const ok = rows.filter((m) => m.owner_id === ownerId && m.status === "ready" && m.request_id === null && m.offer_id === null);
  if (ok.length !== ids.length) throw new HttpError(400, "medya_gecersiz", "Eklenen fotoğraf veya videolardan biri bulunamadı. Lütfen yeniden yükleyin.");
  const count = (k: "image" | "video") => ok.filter((m) => m.kind === k).length;
  if (count("image") > MAX_PER_ITEM.image) throw new HttpError(400, "medya_fazla", `En fazla ${MAX_PER_ITEM.image} fotoğraf ekleyebilirsiniz.`);
  if (count("video") > MAX_PER_ITEM.video) throw new HttpError(400, "medya_fazla", `En fazla ${MAX_PER_ITEM.video} video ekleyebilirsiniz.`);
  const [col, val] = "request_id" in target ? ["request_id", target.request_id] : ["offer_id", target.offer_id];
  await c.query(
    `UPDATE media m SET ${col} = $1, position = x.pos FROM unnest($2::uuid[]) WITH ORDINALITY AS x(id, pos) WHERE m.id = x.id`, [val, ids]);
}

// Bağlanmadan önce yapay zekâ denetimine gidecek fotoğrafların adresleri.
export async function imageUrls(pool: Pool, s: MediaStorage, ownerId: string, ids: string[]) {
  if (!ids.length) return [];
  const { rows } = await pool.query<MediaRow>("SELECT * FROM media WHERE id = ANY($1::uuid[]) AND owner_id = $2 AND kind = 'image' AND status = 'ready'", [ids, ownerId]);
  return rows.map((m) => s.publicUrl(m.storage_key));
}

export async function mediaFor(pool: Pool, s: MediaStorage, col: "request_id" | "offer_id", ids: number[]) {
  const out = new Map<number, PublicMedia[]>();
  if (!ids.length) return out;
  const { rows } = await pool.query<MediaRow & { ref: number }>(
    `SELECT id, kind, content_type, storage_key, ${col} AS ref FROM media WHERE ${col} = ANY($1::bigint[]) ORDER BY ${col}, position`, [ids]);
  for (const m of rows) out.set(m.ref, [...(out.get(m.ref) ?? []), toPublic(s, m)]);
  return out;
}

export function mediaRoutes(app: FastifyInstance, deps: Deps) {
  const { pool, storage } = deps;

  // 1) Yükleme izni: tarayıcıya 10 dakika geçerli, yalnızca bu dosya için imzalı bir adres verilir.
  app.post("/media/uploads", { config: { rateLimit: { max: 60, timeWindow: "1 hour" } } }, async (req, reply) => {
    const user = requireUser(req);
    const b = z.object({ content_type: z.string(), size: z.number().int().min(1) }).parse(req.body);
    const t = MEDIA_TYPES[b.content_type];
    if (!t) throw new HttpError(400, "tur_desteklenmiyor", "Yalnızca JPG, PNG, WEBP fotoğraf ve MP4, MOV, WEBM video yükleyebilirsiniz.");
    if (b.size > MAX_BYTES[t.kind]) throw new HttpError(400, "dosya_buyuk", t.kind === "image" ? "Fotoğraf en fazla 10 MB olabilir." : "Video en fazla 100 MB olabilir.");
    if (!storage.enabled) throw new HttpError(503, "yukleme_kapali", "Fotoğraf ve video yükleme şu anda kullanılamıyor.");
    const today = (await pool.query<{ n: number }>("SELECT count(*)::int AS n FROM media WHERE owner_id = $1 AND created_at > now() - interval '1 day'", [user.id])).rows[0]!.n;
    if (today >= DAILY_UPLOADS) throw new HttpError(429, "cok_fazla_yukleme", "Bugün için yükleme sınırına ulaştınız, yarın tekrar deneyin.");
    const key = `${t.kind}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${t.ext}`;
    const { rows } = await pool.query<{ id: string }>(
      "INSERT INTO media (owner_id, kind, storage_key, content_type, size_bytes) VALUES ($1,$2,$3,$4,$5) RETURNING id", [user.id, t.kind, key, b.content_type, b.size]);
    reply.code(201);
    return { id: rows[0]!.id, kind: t.kind, upload: storage.presignPut(key, b.content_type, b.size) };
  });

  // 2) Yükleme bitti: dosyanın gerçekten yüklendiği, boyut ve türünün beyan edilenle aynı olduğu kontrol edilir.
  app.post("/media/:id/complete", async (req) => {
    const user = requireUser(req);
    const { id } = z.object({ id: z.uuid() }).parse(req.params);
    const m = (await pool.query<MediaRow>("SELECT * FROM media WHERE id = $1 AND owner_id = $2", [id, user.id])).rows[0];
    if (!m) throw new HttpError(404, "bulunamadi", "Dosya bulunamadı.");
    if (m.status === "ready") return toPublic(storage, m);
    const head = await storage.head(m.storage_key);
    if (!head) throw new HttpError(400, "yuklenmedi", "Dosya yüklenemedi, lütfen tekrar deneyin.");
    if (head.size !== m.size_bytes || head.contentType.split(";")[0] !== m.content_type) {
      await storage.remove(m.storage_key);
      await pool.query("DELETE FROM media WHERE id = $1", [id]);
      throw new HttpError(400, "dosya_uyusmuyor", "Yüklenen dosya beklenenle uyuşmuyor, lütfen tekrar deneyin.");
    }
    await pool.query("UPDATE media SET status = 'ready' WHERE id = $1", [id]);
    return toPublic(storage, m);
  });

  // Henüz bir talebe veya teklife eklenmemiş dosyayı siler (formda "kaldır").
  app.delete("/media/:id", async (req) => {
    const user = requireUser(req);
    const { id } = z.object({ id: z.uuid() }).parse(req.params);
    const r = await pool.query<{ storage_key: string; shared: boolean }>(
      `DELETE FROM media m WHERE id = $1 AND owner_id = $2 AND request_id IS NULL AND offer_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM ads a WHERE a.media_id = m.id) AND NOT EXISTS (SELECT 1 FROM stock_images s WHERE s.media_id = m.id)
       RETURNING storage_key, shared`, [id, user.id]);
    if (!r.rowCount) throw new HttpError(404, "bulunamadi", "Silinebilecek dosya bulunamadı.");
    // Galeriden seçilen görselin asıl dosyası galeride kalır.
    if (!r.rows[0]!.shared) await storage.remove(r.rows[0]!.storage_key).catch((e) => req.log.warn({ err: (e as Error).message }, "dosya silinemedi"));
    return { ok: true };
  });

  // Geliştirme ve testlerde bellek deposu: yükleme ve gösterme API üzerinden. Üretimde hiç kaydedilmez.
  if (storage instanceof MemoryStorage && !deps.config.isProd) {
    app.register(async (local) => {
      local.addContentTypeParser("*", { parseAs: "buffer", bodyLimit: MAX_BYTES.video }, (_req, body, done) => done(null, body));
      local.put("/__media/upload/*", async (req, reply) => {
        const key = (req.params as { "*": string })["*"];
        const token = String((req.query as { t?: string }).t ?? "");
        const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
        if (!storage.accept(key, token, String(req.headers["content-type"] ?? ""), body)) return reply.code(403).send({ error: "imza_gecersiz", message: "Yükleme izni geçersiz." });
        return reply.code(200).send();
      });
      local.get("/__media/file/*", async (req, reply) => {
        const f = storage.files.get((req.params as { "*": string })["*"]);
        if (!f) return reply.code(404).send({ error: "bulunamadi", message: "Dosya bulunamadı." });
        return reply.type(f.contentType).send(f.body);
      });
    });
  }
}

// Bir günden eski, hiçbir yere eklenmemiş dosyaları temizler (zamanlanmış görevden çağrılır).
export async function cleanupOrphans(pool: Pool, storage: MediaStorage) {
  const { rows } = await pool.query<{ storage_key: string; shared: boolean }>(
    `DELETE FROM media m WHERE request_id IS NULL AND offer_id IS NULL AND created_at < now() - interval '1 day'
       AND NOT EXISTS (SELECT 1 FROM ads a WHERE a.media_id = m.id) AND NOT EXISTS (SELECT 1 FROM stock_images s WHERE s.media_id = m.id)
       AND NOT EXISTS (SELECT 1 FROM mail_templates t WHERE strpos(t.blocks::text, m.storage_key) > 0)
     RETURNING storage_key, shared`);
  for (const r of rows) if (!r.shared) await storage.remove(r.storage_key).catch(() => {});
  return rows.length;
}
