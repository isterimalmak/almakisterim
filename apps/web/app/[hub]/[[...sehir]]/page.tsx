import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingView, type LandingStats, type LinkGroup } from "@/components/LandingView";
import type { RequestItem } from "@/lib/api";
import { CITIES } from "@/lib/catalog";
import { BIG_CITIES, landingBySlug, type Landing } from "@/lib/landing";
import { locative, OG_BASE, ogImage, slugify } from "@/lib/seo";
import { serverApi } from "@/lib/server-api";

// Arama sayfaları: /nakit-araba-alanlar, /sahibinden-satilik-ev; il için /nakit-araba-alanlar/izmir.
// Listede olmayan adres 404 olur (sitenin diğer sayfaları kendi klasörlerinde, onlar önce eşleşir).
export const dynamic = "force-dynamic";

type P = { params: Promise<{ hub: string; sehir?: string[] }> };

// Popüler marka bağlantıları (araç ve telefon sayfalarında).
const CAR_BRANDS = ["Volkswagen", "Renault", "Fiat", "Ford", "Toyota", "Hyundai", "Honda", "Opel", "Peugeot", "BMW", "Mercedes-Benz", "Audi", "Dacia", "Skoda", "Citroen", "Nissan", "Kia", "Seat", "Togg", "Volvo"];
const PHONE_BRANDS = ["Apple", "Samsung", "Xiaomi", "Huawei", "Oppo", "Realme"];

function resolve(hub: string, sehir: string[] = []) {
  const l = landingBySlug(hub);
  const city = sehir.length === 1 ? CITIES.find((c) => slugify(c) === decodeURIComponent(sehir[0]!)) : undefined;
  const bad = !l || sehir.length > 1 || (sehir.length === 1 && !city);
  return { l: l!, city, bad };
}
const query = (l: Landing, city?: string) =>
  new URLSearchParams({ top: l.top, ...(l.sub ? { sub: l.sub } : {}), ...(city ? { city } : {}), ...(l.filters ?? {}) });
const heading = (l: Landing, city?: string) => (city ? `${locative(city)} ${l.h1}` : l.h1);

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { hub, sehir } = await params;
  const { l, city, bad } = resolve(hub, sehir);
  if (bad) return { title: "Sayfa bulunamadı", robots: { index: false, follow: true } };
  const path = `/${l.slug}${city ? `/${slugify(city)}` : ""}`;
  // İl sayfası: büyük iller her zaman, diğerleri ancak o ilde açık talep varsa arama sonuçlarına açılır.
  const stats = city && !BIG_CITIES.includes(city) ? await serverApi<LandingStats>(`/seo/stats?${query(l, city)}`) : null;
  const thin = !!city && !BIG_CITIES.includes(city) && !(stats?.count);
  const title = city ? `${locative(city)} ${l.title}` : l.title;
  const description = city ? `${locative(city)} ${l.description.charAt(0).toLocaleLowerCase("tr")}${l.description.slice(1)}` : l.description;
  return {
    title: { absolute: `${title} | almakisterim.com` }, description,
    alternates: { canonical: path },
    robots: thin ? { index: false, follow: true } : undefined,
    openGraph: { ...OG_BASE, title, description, url: path, images: ogImage("kategori", l.top, l.sub) },
  };
}

export default async function HubPage({ params }: P) {
  const { hub, sehir } = await params;
  const { l, city, bad } = resolve(hub, sehir);
  if (bad) notFound();
  const q = query(l, city);
  const [stats, list] = await Promise.all([
    serverApi<LandingStats>(`/seo/stats?${q}`),
    serverApi<{ items: RequestItem[] }>(`/requests?${q}&per=12`),
  ]);
  const cityLinks = (stats?.cities.length ? [...new Set([...stats.cities.map((c) => c.city), ...BIG_CITIES])] : BIG_CITIES)
    .filter((c) => c !== city).slice(0, 20);
  const groups: LinkGroup[] = [
    { title: city ? `Diğer illerde ${l.h1.toLocaleLowerCase("tr")}` : `İllere göre ${l.h1.toLocaleLowerCase("tr")}`,
      links: cityLinks.map((c) => ({ href: `/${l.slug}/${slugify(c)}`, label: `${c} ${l.h1.toLocaleLowerCase("tr")}`, n: stats?.cities.find((x) => x.city === c)?.count })) },
    ...(l.brands === "arac" ? [{ title: "Markaya göre araç alıcıları", links: CAR_BRANDS.map((b) => ({ href: `/alicilar/arac/${slugify(b)}`, label: `${b} alıcıları` })) }] : []),
    ...(l.brands === "telefon" ? [{ title: "Markaya göre telefon alıcıları", links: PHONE_BRANDS.map((b) => ({ href: `/alicilar/telefon/${slugify(b)}`, label: `${b} alıcıları` })) }] : []),
    { title: "İlgili aramalar", links: l.related.map((s) => landingBySlug(s)).filter((x): x is Landing => !!x)
      .map((x) => ({ href: city ? `/${x.slug}/${slugify(city)}` : `/${x.slug}`, label: heading(x, city) })) },
  ];
  const listHref = `/kategori/${l.top}${l.sub ? `/${l.sub}` : ""}${city ? `?city=${encodeURIComponent(city)}` : ""}`;
  const metin = l.metin ? `${l.metin}${city ? `${city}` : ""}` : "";
  return (
    <LandingView
      crumbs={[{ name: "Ana Sayfa", path: "/" }, { name: l.h1, path: `/${l.slug}` }, ...(city ? [{ name: city, path: `/${l.slug}/${slugify(city)}` }] : [])]}
      h1={heading(l, city)} intro={l.intro} kind={l.kind} n={l.n} acc={l.acc} place={city ? locative(city) : undefined}
      stats={stats} items={list?.items ?? []} listHref={listHref}
      talepHref={`/talep-ver?kategori=${l.sub ?? l.top}${metin ? `&metin=${encodeURIComponent(metin)}` : ""}`}
      faq={l.faq} groups={groups} />
  );
}
