import type { FastifyInstance } from "fastify";
import type { Deps } from "../context.js";
import type { Pool } from "../db.js";

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

export function categoryRoutes(app: FastifyInstance, { pool }: Deps) {
  app.get("/categories", async () => {
    const { rows } = await pool.query<{ key: string; value: unknown }>("SELECT key, value FROM settings WHERE key IN ('browse_min_requests','show_counts_min','launch_mode')");
    const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return {
      categories: toTree(await listCategories(pool, true)),
      // Gezinme sayfalarında boş kategoriler ve küçük sayaçlar gizlenir; talep verirken hepsi görünür.
      browse: { min_requests: Number(s.browse_min_requests ?? 1), show_counts_min: Number(s.show_counts_min ?? 0) },
      launch_mode: s.launch_mode === true,
    };
  });
}
