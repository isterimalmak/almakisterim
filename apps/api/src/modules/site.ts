import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { requireAdmin, type Deps } from "../context.js";
import { DEFAULT_FAQ, type FaqItem } from "../data/faq.js";
import { HttpError } from "../lib/util.js";

// Sitenin alt bilgisi (footer): sütunlar ve bağlantılar ile en alttaki iki yazı. Yönetim → Alt Bilgi ve Sayfalar.
export type Footer = { columns: { title: string; links: { label: string; href: string }[] }[]; bottom_left: string; bottom_right: string };
export const DEFAULT_FOOTER: Footer = {
  columns: [
    { title: "Kurumsal", links: [{ label: "Hakkımızda", href: "/sayfa/hakkimizda" }, { label: "Sık Sorulan Sorular", href: "/sss" }, { label: "İletişim", href: "/sayfa/iletisim" }, { label: "Blog", href: "/blog" }, { label: "Güvenli Al", href: "/guvenli-al" }] },
    { title: "Alıcılar İçin", links: [{ label: "Ücretsiz Talep Ver", href: "/talep-ver" }, { label: "Tüm Talepler", href: "/kategori" }, { label: "Güvenli Alışveriş İpuçları", href: "/sozlesmeler/guvenli-alisveris" }] },
    { title: "Satıcılar İçin", links: [{ label: "Size Uygun Talepler", href: "/bana-ozel?s=eslesme" }, { label: "Kredi ve Mağaza", href: "/bana-ozel?s=kredi" }, { label: "Talep Alarmları", href: "/bana-ozel?s=alarm" }] },
    { title: "Gizlilik ve Kullanım", links: [{ label: "Sözleşmeler ve Kurallar", href: "/sozlesmeler" }, { label: "Üyelik Sözleşmesi", href: "/sozlesmeler/uyelik-sozlesmesi" }, { label: "KVKK Aydınlatma Metni", href: "/sozlesmeler/kvkk-aydinlatma-metni" }, { label: "Çerez Politikası", href: "/sozlesmeler/cerez-politikasi" }, { label: "Hesap Silme", href: "/sozlesmeler/hesap-silme" }] },
  ],
  bottom_left: "© {yıl} almakisterim.com",
  bottom_right: "Numaranız yalnızca talebinizle ilgilenen sınırlı sayıda satıcıya açılır.",
};

// Bağlantı: site içi yol (/…), https adresi, e-posta veya telefon.
const Href = z.string().trim().max(300).regex(/^(\/[^\s]*|https:\/\/[^\s]+|mailto:[^\s]+|tel:\+?[\d ]+)$/, "Bağlantı / ile başlamalı ya da https://, mailto: veya tel: olmalı.");
const FooterBody = z.object({
  columns: z.array(z.object({
    title: z.string().trim().min(1, "Sütun başlığı boş olamaz.").max(40),
    links: z.array(z.object({ label: z.string().trim().min(1, "Bağlantı adı boş olamaz.").max(60), href: Href })).max(15),
  })).max(6),
  bottom_left: z.string().trim().max(200).default(""),
  bottom_right: z.string().trim().max(300).default(""),
});

export async function siteFooter(pool: Pool): Promise<Footer> {
  const v = (await pool.query<{ value: unknown }>("SELECT value FROM settings WHERE key = 'site_footer'")).rows[0]?.value;
  const p = FooterBody.safeParse(v);
  return p.success ? p.data : DEFAULT_FOOTER;
}

// Ödeme bölümlerinin görünürlüğü (Yönetim → Ayarlar): Güvenli Al ve kredi/ödeme kısımları sitede gizlenebilir.
export async function paymentsUi(pool: Pool) {
  const { rows } = await pool.query<{ key: string; value: unknown }>("SELECT key, value FROM settings WHERE key IN ('show_safe', 'show_credits')");
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { show_safe: s.show_safe !== false, show_credits: s.show_credits !== false };
}
// Gizlenen bölümlere giden bağlantılar alt bilgiden de çıkar.
export function visibleFooter(f: Footer, ui: { show_safe: boolean; show_credits: boolean }): Footer {
  const hide = (href: string) => (!ui.show_safe && href.startsWith("/guvenli-al")) || (!ui.show_credits && /[?&]s=kredi\b/.test(href));
  return { ...f, columns: f.columns.map((c) => ({ ...c, links: c.links.filter((l) => !hide(l.href)) })).filter((c) => c.links.length) };
}

const FaqBody = z.array(z.object({
  group: z.string().trim().min(1, "Grup adı boş olamaz.").max(60),
  q: z.string().trim().min(3, "Soru boş olamaz.").max(300),
  a: z.string().trim().min(1, "Cevap boş olamaz.").max(4000),
  tag: z.enum(["safe", "credits"]).optional(),
})).max(200);
export async function faqItems(pool: Pool): Promise<FaqItem[]> {
  const v = (await pool.query<{ value: unknown }>("SELECT value FROM settings WHERE key = 'faq'")).rows[0]?.value;
  const p = FaqBody.safeParse(v);
  return p.success ? p.data : DEFAULT_FAQ;
}

// Kurumsal sayfalar /sayfa/<adres> altında. Bu adresler sözleşmelere yönlendirildiği için sayfa olarak kullanılamaz.
const RESERVED = ["kullanim-kosullari", "kvkk", "cerez", "hesap-silme", "guvenli-alisveris", "sss"];
const Slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Adres yalnızca küçük harf, rakam ve tire içerebilir (ör. sss).").min(2).max(40);

export function siteRoutes(app: FastifyInstance, { pool }: Deps) {
  // Kurumsal menüde listelenen sayfalar.
  app.get("/pages", async () => ({ items: (await pool.query("SELECT slug, title FROM site_pages ORDER BY CASE slug WHEN 'hakkimizda' THEN 0 WHEN 'iletisim' THEN 2 ELSE 1 END, title")).rows }));

  app.get("/pages/:slug", async (req) => {
    const { slug } = z.object({ slug: z.string().max(60) }).parse(req.params);
    const p = (await pool.query("SELECT slug, title, body, updated_at FROM site_pages WHERE slug = $1", [slug])).rows[0];
    if (!p) throw new HttpError(404, "bulunamadi", "Sayfa bulunamadı.");
    return { page: p };
  });

  // Sık Sorulan Sorular: gizlenen ödeme bölümlerinin soruları gösterilmez.
  app.get("/faq", async () => {
    const ui = await paymentsUi(pool);
    const items = (await faqItems(pool)).filter((x) => (x.tag !== "safe" || ui.show_safe) && (x.tag !== "credits" || ui.show_credits));
    return { items };
  });

  app.get("/admin/site", async (req) => {
    requireAdmin(req);
    const pages = (await pool.query("SELECT slug, title, body, updated_at FROM site_pages ORDER BY slug")).rows;
    return { footer: await siteFooter(pool), default_footer: DEFAULT_FOOTER, pages, faq: await faqItems(pool), default_faq: DEFAULT_FAQ };
  });

  app.put("/admin/faq", async (req) => {
    requireAdmin(req);
    const items = FaqBody.parse(req.body);
    await pool.query("INSERT INTO settings (key, value) VALUES ('faq', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify(items)]);
    return { items };
  });

  app.put("/admin/footer", async (req) => {
    requireAdmin(req);
    const b = FooterBody.parse(req.body);
    await pool.query("INSERT INTO settings (key, value) VALUES ('site_footer', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify(b)]);
    return { footer: b };
  });

  app.put("/admin/pages/:slug", async (req) => {
    requireAdmin(req);
    const slug = Slug.parse((req.params as { slug: string }).slug);
    if (RESERVED.includes(slug)) throw new HttpError(400, "adres_ayrilmis", "Bu adres sözleşmeler için ayrılmış; başka bir adres seçin.");
    const b = z.object({ title: z.string().trim().min(2, "Başlık yazın.").max(120), body: z.string().max(20000) }).parse(req.body);
    const { rows } = await pool.query(
      `INSERT INTO site_pages (slug, title, body) VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, updated_at = now() RETURNING slug, title, body, updated_at`, [slug, b.title, b.body]);
    return { page: rows[0] };
  });

  app.delete("/admin/pages/:slug", async (req) => {
    requireAdmin(req);
    const slug = Slug.parse((req.params as { slug: string }).slug);
    await pool.query("DELETE FROM site_pages WHERE slug = $1", [slug]);
    return { ok: true };
  });
}
