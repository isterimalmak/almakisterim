import type { MetadataRoute } from "next";
import { serverApi } from "@/lib/server-api";
import { BIG_CITIES, LANDINGS } from "@/lib/landing";
import { PRODUCT_MODELS } from "@/lib/products";
import { ilPath, SITE_URL, slugify, talepPath } from "@/lib/seo";

// Site haritası (/sitemap.xml): her istekte API'den güncel liste alınır.
export const dynamic = "force-dynamic";

type Data = {
  requests: { id: number; title: string; city: string | null; created_at: string }[];
  categories: { top: string; sub: string | null; count: number }[];
  places?: { city: string; top: string | null; sub: string | null; count: number }[];
  blog: { slug: string; published_at: string }[];
  pages: { slug: string; updated_at: string }[];
  legal: string[];
  show_safe: boolean;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [d, veh] = await Promise.all([serverApi<Data>("/seo/sitemap"), serverApi<{ cars: Record<string, string[]> }>("/catalog/vehicles")]);
  const u = (path: string) => `${SITE_URL}${path}`;
  const fixed: MetadataRoute.Sitemap = [
    { url: u("/"), changeFrequency: "hourly", priority: 1 },
    { url: u("/kategori"), changeFrequency: "hourly", priority: 0.9 },
    { url: u("/sss"), changeFrequency: "monthly", priority: 0.5 },
    { url: u("/blog"), changeFrequency: "weekly", priority: 0.5 },
    { url: u("/sozlesmeler"), changeFrequency: "monthly", priority: 0.2 },
    ...(d?.show_safe === false ? [] : [{ url: u("/guvenli-al"), changeFrequency: "monthly" as const, priority: 0.4 }]),
  ];
  // Arama sayfaları (/nakit-araba-alanlar…) ve il hâlleri: büyük iller her zaman, diğer iller o kategoride açık talep varsa.
  const hubs: MetadataRoute.Sitemap = LANDINGS.flatMap((l) => {
    const withReq = (d?.places ?? []).filter((p) => p.top === l.top && (l.sub ? p.sub === l.sub : !p.sub)).map((p) => p.city);
    const cities = [...new Set([...BIG_CITIES, ...withReq])];
    return [
      { url: u(`/${l.slug}`), changeFrequency: "daily" as const, priority: 0.8 },
      ...cities.map((c) => ({ url: u(`/${l.slug}/${slugify(c)}`), changeFrequency: "daily" as const, priority: 0.6 })),
    ];
  });
  // Marka ve model alıcı sayfaları (/alicilar/arac/volkswagen/passat, /alicilar/telefon/apple/iphone-15).
  const catalogs: [string, Record<string, string[]>][] = [["arac", veh?.cars ?? {}], ["telefon", PRODUCT_MODELS.telefon ?? {}]];
  const buyers: MetadataRoute.Sitemap = [
    { url: u("/alicilar"), changeFrequency: "daily", priority: 0.7 },
    ...catalogs.flatMap(([k, cat]) => [
      { url: u(`/alicilar/${k}`), changeFrequency: "daily" as const, priority: 0.6 },
      ...Object.entries(cat).flatMap(([b, models]) => [
        { url: u(`/alicilar/${k}/${slugify(b)}`), changeFrequency: "daily" as const, priority: 0.6 },
        ...models.map((m) => ({ url: u(`/alicilar/${k}/${slugify(b)}/${slugify(m)}`), changeFrequency: "weekly" as const, priority: 0.5 })),
      ]),
    ]),
  ];
  if (!d) return [...fixed, ...hubs, ...buyers];
  return [
    ...fixed, ...hubs, ...buyers,
    ...d.categories.map((c) => ({ url: u(c.sub ? `/kategori/${c.top}/${c.sub}` : `/kategori/${c.top}`), changeFrequency: "hourly" as const, priority: c.sub ? 0.7 : 0.8 })),
    // İl sayfaları: yalnız yeterince açık talebi olan il / il + kategori (API süzer).
    ...(d.places ?? []).map((p) => ({ url: u(ilPath(p.city, p.top, p.sub)), changeFrequency: "daily" as const, priority: p.sub ? 0.6 : 0.7 })),
    ...d.requests.map((r) => ({ url: u(talepPath(r)), lastModified: new Date(r.created_at), changeFrequency: "daily" as const, priority: 0.6 })),
    ...d.blog.map((b) => ({ url: u(`/blog/${b.slug}`), lastModified: new Date(b.published_at), changeFrequency: "monthly" as const, priority: 0.5 })),
    ...d.pages.map((p) => ({ url: u(`/sayfa/${p.slug}`), lastModified: new Date(p.updated_at), changeFrequency: "monthly" as const, priority: 0.4 })),
    ...d.legal.map((s) => ({ url: u(`/sozlesmeler/${s}`), changeFrequency: "yearly" as const, priority: 0.1 })),
  ];
}
