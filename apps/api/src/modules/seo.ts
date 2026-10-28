import type { FastifyInstance } from "fastify";
import type { Deps } from "../context.js";
import { listCategories, VISIBLE_CATEGORY_SQL } from "./categories.js";
import { FROM } from "./requests.js";
import { paymentsUi } from "./site.js";
import { LEGAL_DOCS } from "../data/legal/index.js";

// Arama motorları için site haritası verisi (web/app/sitemap.ts adresleri buradan kurar).
// Yalnız herkese açık içerik: yayındaki talepler, yeterince talebi olan kategoriler, blog, sayfalar, sözleşmeler.
export function seoRoutes(app: FastifyInstance, deps: Deps) {
  const { pool } = deps;
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
    return { requests, categories, blog, pages, legal, show_safe: ui.show_safe };
  });
}
