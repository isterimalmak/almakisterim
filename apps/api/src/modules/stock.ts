import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin, requireUser, type Deps } from "../context.js";
import { tx } from "../db.js";
import { HttpError } from "../lib/util.js";
import { randomUUID } from "node:crypto";
import { Pexels, queriesFor, type StockPhoto } from "../services/pexels.js";
import { Pixabay } from "../services/pixabay.js";
import { toPublic } from "./media.js";

// Hazır görsel galerisi: alıcının elinde ürün yok, hayalindekinin görselini galeriden seçer.
// Yönetici görselleri kategori (ve araçta marka/model) ile etiketler; talebe uyanlar önce gösterilir.
type Row = { id: number; title: string; category_id: string; marka: string | null; model: string | null; is_active: boolean; uses: number;
  media_id: string; kind: "image" | "video"; content_type: string; storage_key: string; size_bytes: number };

const SELECT = `SELECT s.id, s.title, s.category_id, s.marka, s.model, s.is_active, s.uses, m.id AS media_id, m.kind, m.content_type, m.storage_key, m.size_bytes
  FROM stock_images s JOIN media m ON m.id = s.media_id`;
const Text = z.string().trim().max(60).nullable().optional().transform((v) => v || null);

export function stockRoutes(app: FastifyInstance, deps: Deps) {
  const { pool, storage } = deps;
  // Ücretsiz fotoğraf kaynağı: Pixabay anahtarı varsa o, yoksa Pexels (ikisi de yoksa kapalı).
  const photoSrc = deps.photos ?? (deps.config.PIXABAY_API_KEY ? new Pixabay(deps.config.PIXABAY_API_KEY) : new Pexels(deps.config.PEXELS_API_KEY));
  const out = (r: Row) => ({ id: Number(r.id), title: r.title, category_id: r.category_id, marka: r.marka, model: r.model, is_active: r.is_active, uses: r.uses,
    media: toPublic(storage, { id: r.media_id, kind: r.kind, content_type: r.content_type, storage_key: r.storage_key }) });

  // ?category=otomobil&araclar=BMW:3 Serisi,Audi: → önce tam model, sonra marka, sonra kategorinin diğer görselleri.
  app.get("/stock-images", async (req) => {
    const q = z.object({ category: z.string().max(40), araclar: z.string().max(400).optional() }).parse(req.query);
    const wanted = (q.araclar ?? "").split(",").map((x) => x.split(":")).filter(([m]) => m).map(([marka, model]) => ({ marka: marka!.trim(), model: (model ?? "").trim() }));
    const { rows } = await pool.query<Row>(
      `${SELECT} JOIN categories c ON c.id = $1
        WHERE s.is_active AND (s.category_id = c.id OR s.category_id = c.parent_id) ORDER BY s.uses DESC, s.id DESC LIMIT 200`, [q.category]);
    const score = (r: Row) => Math.max(0, ...wanted.map((w) => (r.marka === w.marka ? (w.model && r.model === w.model ? 3 : r.model ? 1 : 2) : 0))) + (r.category_id === q.category ? 0.5 : 0);
    const items = rows.map((r) => ({ r, s: score(r) })).sort((a, b) => b.s - a.s).slice(0, 120)
      .map(({ r, s }) => ({ ...out(r), match: s >= 3 ? "model" : s >= 1 ? "marka" : "kategori" }));
    // Kendi galerimizde talebe uyan görsel azsa ücretsiz fotoğraf kaynağında da aranır (anahtar varsa).
    let photos: StockPhoto[] = [];
    if (photoSrc.enabled && items.filter((x) => x.match !== "kategori").length < 6) {
      const qs = queriesFor(q.category, wanted);
      const found = await Promise.all(qs.map((x) => photoSrc.search(x, qs.length > 1 ? 6 : 12).catch((e) => { req.log.warn({ err: (e as Error).message }, "stok fotoğraf arama"); return []; })));
      const seen = new Set<number>();
      photos = found.flat().filter((p) => !seen.has(p.id) && seen.add(p.id)).slice(0, 12);
    }
    return { items: items.map(({ is_active: _a, uses: _u, ...x }) => x), photos, photo_source: photos.length ? { name: photoSrc.name, url: photoSrc.site } : null };
  });

  // Seçilen görsel alıcının dosyası olarak eklenir (aynı dosyayı paylaşır; talepten çıkarınca asıl dosya silinmez).
  app.post("/stock-images/:id/use", { config: { rateLimit: { max: 60, timeWindow: "1 hour" } } }, async (req, reply) => {
    const user = requireUser(req);
    const { id } = z.object({ id: z.coerce.number().int() }).parse(req.params);
    const media = await tx(pool, async (c) => {
      const r = (await c.query<Row>(`${SELECT} WHERE s.id = $1 AND s.is_active`, [id])).rows[0];
      if (!r) throw new HttpError(404, "bulunamadi", "Görsel bulunamadı.");
      const m = (await c.query<{ id: string }>(
        "INSERT INTO media (owner_id, kind, storage_key, content_type, size_bytes, status, shared) VALUES ($1,$2,$3,$4,$5,'ready',true) RETURNING id",
        [user.id, r.kind, r.storage_key, r.content_type, r.size_bytes])).rows[0]!;
      await c.query("UPDATE stock_images SET uses = uses + 1 WHERE id = $1", [id]);
      return toPublic(storage, { id: m.id, kind: r.kind, content_type: r.content_type, storage_key: r.storage_key });
    });
    reply.code(201);
    return media;
  });

  // Seçilen ücretsiz fotoğraf kendi depomuza kopyalanır; kaynaktan kalksa da talepte kalır.
  app.post("/stock-images/photos/:pid/use", { config: { rateLimit: { max: 30, timeWindow: "1 hour" } } }, async (req, reply) => {
    const user = requireUser(req);
    const { pid } = z.object({ pid: z.coerce.number().int().positive() }).parse(req.params);
    if (!photoSrc.enabled || !storage.enabled) throw new HttpError(503, "kapali", "Hazır görseller şu anda kullanılamıyor.");
    let photo: StockPhoto | null, file: { body: Buffer; contentType: string };
    try {
      photo = await photoSrc.photo(pid);
      if (!photo) throw new HttpError(404, "bulunamadi", "Görsel bulunamadı.");
      file = await photoSrc.download(photo);
    } catch (e) {
      if (e instanceof HttpError) throw e;
      req.log.warn({ err: (e as Error).message }, "stok fotoğraf indirme");
      throw new HttpError(502, "indirilemedi", "Görsel alınamadı, lütfen başka bir görsel seçin.");
    }
    const ext = file.contentType === "image/png" ? "png" : file.contentType === "image/webp" ? "webp" : "jpg";
    const key = `image/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${ext}`;
    await storage.put(key, file.contentType, file.body);
    const { rows } = await pool.query<{ id: string }>(
      "INSERT INTO media (owner_id, kind, storage_key, content_type, size_bytes, status) VALUES ($1,'image',$2,$3,$4,'ready') RETURNING id",
      [user.id, key, file.contentType, file.body.length]);
    reply.code(201);
    return toPublic(storage, { id: rows[0]!.id, kind: "image", content_type: file.contentType, storage_key: key });
  });

  app.get("/admin/stock-images", async (req) => {
    requireAdmin(req);
    const { rows } = await pool.query<Row>(`${SELECT} ORDER BY s.is_active DESC, s.id DESC`);
    return { items: rows.map(out) };
  });

  // Yönetici dosyayı normal yükleme akışıyla yükler, sonra galeriye etiketleyerek ekler.
  app.post("/admin/stock-images", async (req, reply) => {
    const admin = requireAdmin(req);
    const b = z.object({ media_id: z.uuid(), category_id: z.string().max(40), marka: Text, model: Text, title: z.string().trim().max(120).default("") }).parse(req.body);
    const id = await tx(pool, async (c) => {
      const m = (await c.query("SELECT 1 FROM media WHERE id = $1 AND owner_id = $2 AND status = 'ready' AND kind = 'image' AND request_id IS NULL AND offer_id IS NULL AND NOT shared", [b.media_id, admin.id])).rowCount;
      if (!m) throw new HttpError(400, "medya_gecersiz", "Görsel bulunamadı. Lütfen yeniden yükleyin.");
      if (!(await c.query("SELECT 1 FROM categories WHERE id = $1", [b.category_id])).rowCount) throw new HttpError(400, "kategori_gecersiz", "Kategori bulunamadı.");
      return Number((await c.query<{ id: number }>(
        "INSERT INTO stock_images (media_id, category_id, marka, model, title) VALUES ($1,$2,$3,$4,$5) RETURNING id",
        [b.media_id, b.category_id, b.marka, b.model, b.title])).rows[0]!.id);
    });
    reply.code(201);
    return out((await pool.query<Row>(`${SELECT} WHERE s.id = $1`, [id])).rows[0]!);
  });

  // Kaldırma = yayından alma; görseli seçmiş taleplerde resim bozulmasın diye dosya silinmez.
  app.patch("/admin/stock-images/:id", async (req) => {
    requireAdmin(req);
    const { id } = z.object({ id: z.coerce.number().int() }).parse(req.params);
    const b = z.object({ is_active: z.boolean().optional(), title: z.string().trim().max(120).optional(), marka: Text, model: Text, category_id: z.string().max(40).optional() }).parse(req.body);
    const sets: string[] = [], params: unknown[] = [id];
    for (const k of ["is_active", "title", "marka", "model", "category_id"] as const) {
      if (b[k] !== undefined) { params.push(b[k]); sets.push(`${k} = $${params.length}`); }
    }
    if (sets.length && !(await pool.query(`UPDATE stock_images SET ${sets.join(", ")} WHERE id = $1`, params)).rowCount) throw new HttpError(404, "bulunamadi", "Görsel bulunamadı.");
    const r = (await pool.query<Row>(`${SELECT} WHERE s.id = $1`, [id])).rows[0];
    if (!r) throw new HttpError(404, "bulunamadi", "Görsel bulunamadı.");
    return out(r);
  });
}
