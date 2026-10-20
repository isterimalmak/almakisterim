import type { FastifyInstance } from "fastify";
import type { Deps } from "../context.js";
import type { Pool } from "../db.js";
import { z } from "zod";
import { LOCATIONS, matchDistrict } from "../data/locations.js";
import { HttpError } from "../lib/util.js";

export type CategoryRow = { id: string; parent_id: string | null; name: string; icon: string; sort: number; is_visible: boolean; active_count: number };

// Bir alt kategori; kendisi ve üst kategorisi görünürse yayındadır.
export const VISIBLE_CATEGORY_SQL = `c.is_visible AND (c.parent_id IS NULL OR p.is_visible)`;

export async function listCategories(pool: Pool, onlyVisible: boolean): Promise<CategoryRow[]> {
  const { rows } = await pool.query<CategoryRow>(
    `SELECT c.id, c.parent_id, c.name, c.icon, c.sort, c.is_visible,
            (SELECT count(*)::int FROM requests r
               LEFT JOIN categories rc ON rc.id = r.category_id
              WHERE r.status = 'active' AND r.expires_at > now()
                AND (r.category_id = c.id OR rc.parent_id = c.id)) AS active_count
       FROM categories c LEFT JOIN categories p ON p.id = c.parent_id
      ${onlyVisible ? `WHERE ${VISIBLE_CATEGORY_SQL}` : ""}
      ORDER BY c.parent_id NULLS FIRST, c.sort, c.name`,
  );
  return rows;
}

export function toTree(rows: CategoryRow[]) {
  const tops = rows.filter((r) => !r.parent_id);
  return tops.map((t) => ({ ...t, subs: rows.filter((r) => r.parent_id === t.id) }));
}

export async function visibleSubcategory(pool: Pool, id: string) {
  const { rows } = await pool.query<{ id: string; name: string; parent_id: string }>(
    `SELECT c.id, c.name, c.parent_id FROM categories c JOIN categories p ON p.id = c.parent_id
      WHERE c.id = $1 AND ${VISIBLE_CATEGORY_SQL}`, [id]);
  return rows[0] ?? null;
}

export function categoryRoutes(app: FastifyInstance, { pool, storage }: Deps) {
  // İl seçilince ilçeler, ilçe seçilince mahalleler (PTT listesi). Değişmediği için uzun süre önbelleğe alınır.
  app.get("/locations", async (req, reply) => {
    const q = z.object({ il: z.string().max(40), ilce: z.string().max(60).optional() }).parse(req.query);
    const city = LOCATIONS[q.il];
    if (!city) throw new HttpError(404, "il_yok", "İl bulunamadı.");
    reply.header("cache-control", "public, max-age=86400");
    if (!q.ilce) return { districts: Object.keys(city) };
    const d = matchDistrict(q.il, q.ilce);
    if (!d) throw new HttpError(404, "ilce_yok", "İlçe bulunamadı.");
    return { neighbourhoods: city[d] };
  });

  app.get("/categories", async () => {
    const { rows } = await pool.query<{ key: string; value: unknown }>("SELECT key, value FROM settings WHERE key IN ('browse_min_requests','show_counts_min','launch_mode','phone_required','home_urgent_box','photo_required','home_vitrin','home_latest','home_order','home_hidden')");
    const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return {
      categories: toTree(await listCategories(pool, true)),
      // Gezinme sayfalarında boş kategoriler ve küçük sayaçlar gizlenir; talep verirken hepsi görünür.
      browse: { min_requests: Number(s.browse_min_requests ?? 1), show_counts_min: Number(s.show_counts_min ?? 0) },
      launch_mode: s.launch_mode === true,
      phone_required: s.phone_required === true,
      home_urgent_box: s.home_urgent_box === true,
      // Ana sayfadaki vitrin ve son talepler: yönetici gizleyebilir (varsayılan açık).
      home_vitrin: s.home_vitrin !== false,
      home_latest: s.home_latest !== false,
      // Ana sayfa bölümlerinin sırası ve gizlenenler (yönetim → Ana Sayfa Düzeni).
      home_order: Array.isArray(s.home_order) ? s.home_order : [],
      home_hidden: Array.isArray(s.home_hidden) ? s.home_hidden : [],
      // Dosya deposu bağlı değilken fotoğraf istenemez.
      photo_required: s.photo_required === true && storage.enabled,
    };
  });
}
