import type { FastifyInstance } from "fastify";
import type { Deps } from "../context.js";
import { listCategories, VISIBLE_CATEGORY_SQL } from "./categories.js";
import { FROM, listFilters } from "./requests.js";
import { paymentsUi } from "./site.js";
import { LEGAL_DOCS } from "../data/legal/index.js";

// Arama motorları için site haritası verisi (web/app/sitemap.ts adresleri buradan kurar).
// Yalnız herkese açık içerik: yayındaki talepler, yeterince talebi olan kategoriler, blog, sayfalar, sözleşmeler.
// İl sayfası (/il/istanbul/vasita) arama motorlarına ancak bu kadar açık talep varsa açılır; daha azı "zayıf içerik" sayılır.
export const PLACE_MIN = 3;

type Place = { city: string; top: string | null; sub: string | null; count: number };
// İl bazında açık talep sayıları: il, il+kategori, il+alt kategori (gizli kategoriler hariç).
async function places(pool: Deps["pool"]): Promise<Place[]> {
  const { rows } = await pool.query<Place>(
    `SELECT r.city, p.id AS top, c.id AS sub, count(*)::int AS count ${FROM}
      WHERE r.status = 'active' AND r.expires_at > now() AND ${VISIBLE_CATEGORY_SQL} AND r.city <> ''
      GROUP BY GROUPING SETS ((r.city), (r.city, p.id), (r.city, p.id, c.id))
      ORDER BY count DESC, r.city`);
  return rows;
}

export function seoRoutes(app: FastifyInstance, deps: Deps) {
  const { pool } = deps;
  // İl sayfaları için sayılar (web/app/il); yalnız sayı, talep içeriği yok.
  app.get("/seo/places", async () => ({ places: await places(pool), min: PLACE_MIN }));
  // Arama sayfaları (/nakit-araba-alanlar, /alicilar/arac/volkswagen/passat…) için talep listesiyle aynı süzgeçlerle özet:
  // açık talep sayısı, bütçeler, en çok aranan iller ve bugüne kadarki (kapanan ve süresi dolanlar dahil) talep sayısı.
  // Yalnız sayı döner; talep içeriği ya da alıcı bilgisi yok.
  app.get("/seo/stats", async (req) => {
    const { where, params } = listFilters(req.query as Record<string, unknown>);
    const w = where.join(" AND ");
    const [agg, cities] = await Promise.all([
      pool.query<{ count: number; avg: number | null; max: number | null }>(
        `SELECT count(*)::int AS count, round(avg(r.budget_max))::bigint AS avg, max(r.budget_max)::bigint AS max ${FROM} WHERE ${w}`, params),
      pool.query<{ city: string; count: number }>(
        `SELECT r.city, count(*)::int AS count ${FROM} WHERE ${w} AND r.city <> '' GROUP BY r.city ORDER BY count DESC, r.city LIMIT 10`, params),
    ]);
    // Bugüne kadarki talepler: açık olma koşulu (ilk iki süzgeç) yerine yayımlanmış her talep.
    const ever = await pool.query<{ count: number }>(
      `SELECT count(*)::int AS count ${FROM} WHERE r.status IN ('active','closed','expired') AND ${where.slice(2).join(" AND ")}`, params);
    const a = agg.rows[0]!;
    return { count: a.count, avg_budget: a.avg === null ? null : Number(a.avg), max_budget: a.max === null ? null : Number(a.max), cities: cities.rows, ever: ever.rows[0]!.count };
  });
  app.get("/seo/sitemap", async () => {
    const requests = (await pool.query<{ id: number; title: string; city: string | null; created_at: string }>(
      `SELECT r.id, r.title, r.city, r.created_at ${FROM}
        WHERE r.status = 'active' AND r.expires_at > now() AND ${VISIBLE_CATEGORY_SQL}
        ORDER BY r.created_at DESC LIMIT 40000`)).rows.map((r) => ({ ...r, id: Number(r.id) }));
    // Boş kategori sayfaları "zayıf içerik" sayılır; menüde görünme sınırı (browse_min_requests) burada da geçerli.
    const min = Number((await pool.query<{ value: unknown }>("SELECT value FROM settings WHERE key = 'browse_min_requests'")).rows[0]?.value ?? 1);
    const cats = await listCategories(pool, true);
    const categories = cats.filter((c) => c.active_count >= Math.max(1, min))
      .map((c) => ({ top: c.parent_id ?? c.id, sub: c.parent_id ? c.id : null, count: c.active_count }));
    const blog = (await pool.query<{ slug: string; published_at: string }>(
      "SELECT slug, published_at FROM blog_posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 1000")).rows;
    const pages = (await pool.query<{ slug: string; updated_at: string }>("SELECT slug, updated_at FROM site_pages ORDER BY slug")).rows;
    const ui = await paymentsUi(pool);
    const hidden = [...(ui.show_safe ? [] : ["guvenli-al-sozlesmesi"]), ...(ui.show_credits ? [] : ["on-bilgilendirme-formu", "mesafeli-satis-sozlesmesi"])];
    const legal = LEGAL_DOCS.map((d) => d.slug).filter((s) => !hidden.includes(s));
    const place = (await places(pool)).filter((x) => x.count >= PLACE_MIN);
    return { requests, categories, places: place, blog, pages, legal, show_safe: ui.show_safe };
  });
}
