import type { Metadata } from "next";
import Link from "next/link";
import { HomeView, type HomeList, type Tanitim } from "@/components/HomeView";

import { fmt } from "@/lib/format";
import { alimTalepleri, ilPath, locative } from "@/lib/seo";
import { serverApi, siteData } from "@/lib/server-api";

// Ana sayfa sunucuda hazırlanır: son talepler, sitenin ne olduğu ve kategori/il bağlantıları sayfanın kendisinde gelir.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { alternates: { canonical: "/" } };

type Place = { city: string; top: string | null; sub: string | null; count: number };

export default async function Home() {
  const [latest, urgent, vitrin, corp, tanitim, cats, pl] = await Promise.all([
    serverApi<HomeList>("/requests?per=10"),
    serverApi<HomeList>("/requests?urgent=1&per=8"),
    serverApi<HomeList>("/requests?sort=vitrin&per=20"),
    serverApi<HomeList>("/requests?buyer=kurumsal&per=5"),
    serverApi<Tanitim>("/tanitim"),
    siteData(),
    serverApi<{ places: Place[]; min: number }>("/seo/places"),
  ]);
  const tops = cats?.categories ?? [];
  const subs = tops.flatMap((t) => t.subs.filter((x) => x.active_count > 0).map((x) => ({ ...x, top: t.id })))
    .sort((a, b) => b.active_count - a.active_count).slice(0, 16);
  const cities = (pl?.places ?? []).filter((p) => !p.top && p.count >= pl!.min).slice(0, 16);
  return (
    <>
      <HomeView initial={{ latest, urgent, vitrin, corp, tanitim }} />
      <div className="wrap">
        <section className="box home-about" aria-labelledby="ne-bu">
          <div className="box-b">
            <h2 id="ne-bu">almakisterim.com nedir?</h2>
            <p>almakisterim.com, alıcının <b>ne almak istediğini yazdığı</b> bir alım talebi sitesidir. İlan ilan dolaşmak yerine aradığınızı bütçenizle birlikte yazarsınız; elinde uygun ürün olan satıcılar size ulaşır. Talep vermek ücretsizdir.</p>
            <p>Araç, emlak, elektronik, ev eşyası ve hizmet gibi kategorilerdeki alım talepleri herkese açıktır. Satıcıysanız il ve kategorinize göre talep alarmı kurun; yeni bir alıcı talebi geldiğinde size haber verelim.</p>
            {tops.length > 0 && (<>
              <h3>Kategoriler</h3>
              <ul className="ha-links">
                {tops.map((t) => <li key={t.id}><Link href={`/kategori/${t.id}`}>{alimTalepleri(t.name)}</Link></li>)}
                {subs.map((s) => <li key={s.id}><Link href={`/kategori/${s.top}/${s.id}`}>{s.name} almak isteyenler</Link> <span className="muted">({fmt(s.active_count)})</span></li>)}
              </ul>
            </>)}
            {cities.length > 0 && (<>
              <h3>İllere göre talepler</h3>
              <ul className="ha-links">
                {cities.map((p) => <li key={p.city}><Link href={ilPath(p.city)}>{locative(p.city)} alım talepleri</Link> <span className="muted">({fmt(p.count)})</span></li>)}
              </ul>
            </>)}
          </div>
        </section>
      </div>
    </>
  );
}
