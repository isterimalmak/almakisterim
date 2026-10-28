import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RequestTable } from "@/components/RequestTable";
import type { RequestItem } from "@/lib/api";
import { CITIES } from "@/lib/catalog";
import { fmt } from "@/lib/format";
import { ilPath, ldJson, locative, OG_BASE, ogImage, SITE_URL, slugify } from "@/lib/seo";
import { serverApi, siteData } from "@/lib/server-api";

// İl sayfaları: "İstanbul'da Vasıta Alım Talepleri" gibi il + kategori aramaları için sunucuda hazırlanan liste.
// Adres: /il/istanbul, /il/istanbul/vasita, /il/istanbul/vasita/otomobil. Az talepli sayfa arama sonuçlarına girmez.
export const dynamic = "force-dynamic";

type P = { params: Promise<{ sehir: string; kat?: string[] }> };
type Place = { city: string; top: string | null; sub: string | null; count: number };

async function resolve(sehir: string, kat: string[] = []) {
  const city = CITIES.find((c) => slugify(c) === decodeURIComponent(sehir));
  const [cats, pl] = await Promise.all([
    siteData(),
    serverApi<{ places: Place[]; min: number }>("/seo/places"),
  ]);
  const categories = cats?.categories ?? [];
  const [top, sub] = kat;
  const t = top ? categories.find((c) => c.id === top) : undefined;
  const s = t && sub ? t.subs.find((x) => x.id === sub) : undefined;
  const unknown = !city || kat.length > 2 || (!!top && !t) || (!!sub && !s);
  const places = pl?.places ?? [];
  const count = places.find((p) => p.city === city && p.top === (t?.id ?? null) && p.sub === (s?.id ?? null))?.count ?? 0;
  return { city: city!, t, s, unknown, places, count, min: pl?.min ?? 3, categories };
}

const names = (city: string, name?: string) => ({
  h1: `${locative(city)} ${name ? `${name} ` : ""}Alım Talepleri`,
  title: name ? `${locative(city)} ${name} Alım Talepleri – ${name} Almak İsteyenler` : `${locative(city)} Alım Talepleri – ${city} Alıcıları`,
});

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { sehir, kat } = await params;
  const { city, t, s, unknown, count, min } = await resolve(sehir, kat);
  if (unknown) return { title: "Sayfa bulunamadı", robots: { index: false, follow: true } };
  const name = s?.name ?? t?.name;
  const { title } = names(city, name);
  const description = `${locative(city)} ${name ? `${name.toLocaleLowerCase("tr")} ` : ""}almak isteyen alıcıların güncel talepleri${count ? ` (${fmt(count)} açık talep)` : ""}. Elinizde uygun ürün varsa alıcıya doğrudan ulaşın. almakisterim.com`;
  const path = ilPath(city, t?.id, s?.id);
  return {
    title, description,
    alternates: { canonical: path },
    robots: count < min ? { index: false, follow: true } : undefined,
    openGraph: { ...OG_BASE, title, description, url: path, images: ogImage("il", slugify(city), t?.id, s?.id) },
  };
}

export default async function IlPage({ params }: P) {
  const { sehir, kat } = await params;
  const { city, t, s, unknown, places, count, categories } = await resolve(sehir, kat);
  if (unknown) notFound();
  const name = s?.name ?? t?.name;
  const qs = new URLSearchParams({ city, per: "30", ...(t ? { top: t.id } : {}), ...(s ? { sub: s.id } : {}) });
  const list = await serverApi<{ total: number; items: RequestItem[] }>(`/requests?${qs}`);
  const items = list?.items ?? [];
  const { h1 } = names(city, name);
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;
  const subName = (top: string, id: string) => categories.find((c) => c.id === top)?.subs.find((x) => x.id === id)?.name ?? id;
  // Bu ildeki alt kırılımlar (il → kategoriler, kategori → alt kategoriler) ve aynı kategorinin diğer illeri.
  const inside = places.filter((p) => p.city === city && (t ? p.top === t.id && p.sub && !s : p.top && !p.sub));
  const otherCities = places.filter((p) => p.city !== city && p.top === (t?.id ?? null) && p.sub === (s?.id ?? null)).slice(0, 24);
  const crumbs = [
    { name: "Ana Sayfa", path: "/" },
    { name: city, path: ilPath(city) },
    ...(t ? [{ name: t.name, path: ilPath(city, t.id) }] : []),
    ...(s ? [{ name: s.name, path: ilPath(city, t!.id, s.id) }] : []),
  ];
  return (
    <div className="wrap il-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson({
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: `${SITE_URL}${c.path === "/" ? "" : c.path}` })),
      }) }} />
      <nav className="crumb" aria-label="Konum">
        {crumbs.map((c, i) => <span key={c.path}>{i > 0 && " › "}{i < crumbs.length - 1 ? <Link href={c.path}>{c.name}</Link> : c.name}</span>)}
      </nav>
      <h1 className="il-h1">{h1}</h1>
      <p className="il-intro">
        {count > 0
          ? <>{locative(city)} {name ? `${name.toLocaleLowerCase("tr")} ` : ""}almak isteyen alıcıların <b>{fmt(count)} açık talebi</b> var. Elinizde uygun ürün varsa talebi açın, alıcıya doğrudan teklif verin.</>
          : <>{locative(city)} şu an açık {name ? `${name.toLocaleLowerCase("tr")} ` : ""}talebi yok. Almak istediğinizi yazın, satıcılar size ulaşsın; satıcıysanız talep alarmı kurun.</>}
      </p>

      <section className="box" style={{ marginBottom: 14 }}>
        <div className="box-h"><h2>Güncel talepler</h2><Link className="link" href={`${t ? `/kategori/${t.id}${s ? `/${s.id}` : ""}` : "/kategori"}`}>Türkiye geneli ›</Link></div>
        <RequestTable items={items} empty={`${locative(city)} bu kategoride açık talep yok.`} />
        <div className="box-b il-cta">
          <Link className="btn btn-or" href={`/talep-ver${t ? `?kategori=${t.id}` : ""}`}>Ücretsiz talep ver</Link>
          <Link className="btn btn-bl" href="/bana-ozel?s=alarm">Talep alarmı kur</Link>
        </div>
      </section>

      {inside.length > 0 && (
        <section className="box" style={{ marginBottom: 14 }}>
          <div className="box-h"><h2>{t ? `${locative(city)} ${t.name} kategorileri` : `${locative(city)} kategoriler`}</h2></div>
          <div className="box-b chips">
            {inside.map((p) => (
              <Link key={`${p.top}-${p.sub}`} className="chip" href={ilPath(city, p.top, p.sub)}>
                {p.sub ? subName(p.top!, p.sub) : catName(p.top!)} <span className="muted">({fmt(p.count)})</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {otherCities.length > 0 && (
        <section className="box" style={{ marginBottom: 14 }}>
          <div className="box-h"><h2>{name ? `Diğer illerde ${name} talepleri` : "Diğer iller"}</h2></div>
          <div className="box-b chips">
            {otherCities.map((p) => (
              <Link key={p.city} className="chip" href={ilPath(p.city, t?.id, s?.id)}>{p.city} <span className="muted">({fmt(p.count)})</span></Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
