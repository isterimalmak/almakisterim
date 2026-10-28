import type { Metadata } from "next";
import Link from "next/link";
import { CategoryView, type ListingInitial } from "@/components/CategoryView";
import type { RequestItem } from "@/lib/api";
import { fmt } from "@/lib/format";
import { ilPath, ldJson, locative, OG_BASE, ogImage, SITE_URL } from "@/lib/seo";
import { serverApi, siteData } from "@/lib/server-api";

// Kategori sayfaları: her kategori ve alt kategori kendi başlığı ve açıklamasıyla arama motorlarında yer alır.
// Arama ve süzgeç sonuçları (?q=…) dizine girmez; asıl adres kategorinin kendisidir.
export const dynamic = "force-dynamic";

type P = { params: Promise<{ slug?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function resolve(slug: string[] = []) {
  const cats = (await siteData())?.categories ?? [];
  const [top, sub] = slug;
  const t = top ? cats.find((c) => c.id === top) : undefined;
  const s = t && sub ? t.subs.find((x) => x.id === sub) : undefined;
  const total = cats.reduce((n, c) => n + c.active_count, 0);
  return { t, s, total, unknown: (!!top && !t) || (!!sub && !s) };
}

export async function generateMetadata({ params, searchParams }: P): Promise<Metadata> {
  const { slug = [] } = await params;
  const sp = await searchParams;
  const { t, s, total, unknown } = await resolve(slug);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const path = s ? `/kategori/${t!.id}/${s.id}` : t ? `/kategori/${t.id}` : "/kategori";
  const filtered = Object.keys(sp).length > 0;
  if (unknown) return { title: "Talepler", robots: { index: false, follow: true } };
  if (q) return { title: `"${q.slice(0, 60)}" alım talepleri`, robots: { index: false, follow: true }, alternates: { canonical: path } };

  const name = s?.name ?? t?.name;
  const count = s?.active_count ?? t?.active_count ?? total;
  const title = name ? `${name} Alım Talepleri – ${name} Almak İsteyenler` : "Tüm Alım Talepleri – Almak İsteyen Alıcılar";
  const what = name ? `${name} almak isteyen` : "Araç, emlak, elektronik, eşya ve hizmet almak isteyen";
  const description = `${what} alıcıların güncel talepleri${count ? ` (${fmt(count)} açık talep)` : ""}. Elinizde uygun ürün varsa alıcıya doğrudan ulaşın; yeni talepler için alarm kurun. almakisterim.com`;
  return {
    title, description,
    alternates: { canonical: path },
    // Talebi olmayan kategori ve süzgeçli liste arama sonuçlarına girmez ("zayıf içerik" sayılmasın).
    robots: count === 0 || filtered ? { index: false, follow: true } : undefined,
    openGraph: { ...OG_BASE, title, description, url: path, images: t ? ogImage("kategori", t.id, s?.id) : ogImage("site") },
  };
}

type Place = { city: string; top: string | null; sub: string | null; count: number };

export default async function KategoriPage({ params, searchParams }: P) {
  const { slug = [] } = await params;
  const { t, s } = await resolve(slug);
  // Süzgeçsiz açılışta ilk sayfa sunucuda hazırlanır (CategoryView'deki sorguyla aynı sırada).
  let initial: ListingInitial | null = null;
  if (!Object.keys(await searchParams).length) {
    const p = new URLSearchParams();
    if (t) p.set("top", t.id);
    if (s) p.set("sub", s.id);
    p.set("sort", "new"); p.set("page", "1"); p.set("per", "20");
    const data = await serverApi<{ total: number; items: RequestItem[] }>(`/requests?${p}`);
    if (data) initial = { qs: p.toString(), data };
  }
  // Bu kategorinin yeterince talebi olan illeri: il sayfalarına bağlantı (arama motorları da bu yoldan bulur).
  const pl = await serverApi<{ places: Place[]; min: number }>("/seo/places");
  const cities = (pl?.places ?? []).filter((p) => p.top === (t?.id ?? null) && p.sub === (s?.id ?? null) && p.count >= pl!.min).slice(0, 30);
  return (
    <>
      {t && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson({
          "@context": "https://schema.org", "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: t.name, item: `${SITE_URL}/kategori/${t.id}` },
            ...(s ? [{ "@type": "ListItem", position: 3, name: s.name, item: `${SITE_URL}/kategori/${t.id}/${s.id}` }] : []),
          ],
        }) }} />
      )}
      <CategoryView initial={initial} />
      {cities.length > 0 && (
        <div className="wrap">
          <section className="box il-links" aria-label="İllere göre talepler">
            <div className="box-h"><h2>{s?.name ?? t?.name ?? "Alım talepleri"} · illere göre</h2></div>
            <div className="box-b chips">
              {cities.map((p) => <Link key={p.city} className="chip" href={ilPath(p.city, t?.id, s?.id)}>{locative(p.city)} <span className="muted">({fmt(p.count)})</span></Link>)}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
