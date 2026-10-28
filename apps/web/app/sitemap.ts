import type { MetadataRoute } from "next";
import { serverApi } from "@/lib/server-api";
import { SITE_URL, talepPath } from "@/lib/seo";

// Site haritası (/sitemap.xml): her istekte API'den güncel liste alınır.
export const dynamic = "force-dynamic";

type Data = {
  requests: { id: number; title: string; city: string | null; created_at: string }[];
  categories: { top: string; sub: string | null; count: number }[];
  blog: { slug: string; published_at: string }[];
  pages: { slug: string; updated_at: string }[];
  legal: string[];
  show_safe: boolean;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const d = await serverApi<Data>("/seo/sitemap");
  const u = (path: string) => `${SITE_URL}${path}`;
  const fixed: MetadataRoute.Sitemap = [
    { url: u("/"), changeFrequency: "hourly", priority: 1 },
    { url: u("/kategori"), changeFrequency: "hourly", priority: 0.9 },
    { url: u("/sss"), changeFrequency: "monthly", priority: 0.5 },
    { url: u("/blog"), changeFrequency: "weekly", priority: 0.5 },
    { url: u("/sozlesmeler"), changeFrequency: "monthly", priority: 0.2 },
    ...(d?.show_safe === false ? [] : [{ url: u("/guvenli-al"), changeFrequency: "monthly" as const, priority: 0.4 }]),
  ];
  if (!d) return fixed;
  return [
    ...fixed,
    ...d.categories.map((c) => ({ url: u(c.sub ? `/kategori/${c.top}/${c.sub}` : `/kategori/${c.top}`), changeFrequency: "hourly" as const, priority: c.sub ? 0.7 : 0.8 })),
    ...d.requests.map((r) => ({ url: u(talepPath(r)), lastModified: new Date(r.created_at), changeFrequency: "daily" as const, priority: 0.6 })),
    ...d.blog.map((b) => ({ url: u(`/blog/${b.slug}`), lastModified: new Date(b.published_at), changeFrequency: "monthly" as const, priority: 0.5 })),
    ...d.pages.map((p) => ({ url: u(`/sayfa/${p.slug}`), lastModified: new Date(p.updated_at), changeFrequency: "monthly" as const, priority: 0.4 })),
    ...d.legal.map((s) => ({ url: u(`/sozlesmeler/${s}`), changeFrequency: "yearly" as const, priority: 0.1 })),
  ];
}
