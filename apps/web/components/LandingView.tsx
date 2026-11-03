import Link from "next/link";
import { RequestTable } from "@/components/RequestTable";
import type { RequestItem } from "@/lib/api";
import { fmt } from "@/lib/format";
import { ldJson, SITE_URL } from "@/lib/seo";

// Arama sayfalarının (nakit araba alanlar, sahibinden satılık ev, Passat alıcıları…) ortak görünümü:
// başlık, konuya özel metin, canlı sayılar, güncel talepler, adımlar, bağlantı grupları ve sık sorulan sorular.
// Sunucuda hazırlanır; arama motoru sayfanın tamamını okur.

export type LandingStats = { count: number; avg_budget: number | null; max_budget: number | null; cities: { city: string; count: number }[]; ever: number };
export type LinkGroup = { title: string; links: { href: string; label: string; n?: number }[] };

export function LandingView(p: {
  crumbs: { name: string; path: string }[];
  h1: string; intro: string[]; kind: "sat" | "al";
  n: string; acc: string; place?: string;
  stats: LandingStats | null; items: RequestItem[]; listHref: string;
  talepHref: string; faq: [string, string][]; groups: LinkGroup[];
}) {
  const s = p.stats;
  const where = p.place ? `${p.place} ` : "";
  const ld = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: p.crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: `${SITE_URL}${c.path === "/" ? "" : c.path}` })) },
    ...(p.faq.length ? [{ "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: p.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }] : []),
  ];
  // Satıcı için: talepleri incele → alıcıya ulaş → alarm kur. Alıcı için: yaz → teklifleri al → seç.
  const steps = p.kind === "sat"
    ? [[`${cap(p.n)} arayan alıcıları görün`, `Aşağıdaki taleplerde alıcının istediği ${p.n}, bütçesi ve ili yazar. Kayıt olmadan inceleyebilirsiniz.`],
       ["Alıcıya doğrudan ulaşın", "Uygun talebi açın, numarayı görün ya da mesaj yazın. Aracı ve komisyon yok."],
       ["Alarm kurun, ilk siz duyun", `Uygun talep yoksa alarm kurun; ${p.n} almak isteyen yeni bir alıcı geldiğinde size hemen haber verelim.`]]
    : [["Ne aradığınızı yazın", `Tek cümle yeterli: istediğiniz ${p.n}, bütçeniz ve iliniz. Talep vermek ücretsiz.`],
       ["Sahipleri size ulaşsın", `Elinde uygun ${p.n} olan sahipleri ve satıcılar talebinizi görür, sizi arar ya da mesaj atar.`],
       ["Karşılaştırın, seçin", "Gelen teklifleri karşılaştırın. Aradığınızı bulunca talebi kapatın; numaranız artık gösterilmez."]];
  return (
    <div className="wrap il-page lp">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(ld) }} />
      <nav className="crumb" aria-label="Konum">
        {p.crumbs.map((c, i) => <span key={c.path}>{i > 0 && " › "}{i < p.crumbs.length - 1 ? <Link href={c.path}>{c.name}</Link> : c.name}</span>)}
      </nav>
      <section className="lp-hero">
        <h1 className="il-h1">{p.h1}</h1>
        {p.intro.map((t) => <p key={t} className="il-intro">{t}</p>)}
        <div className="lp-cta">
          {p.kind === "sat" ? <>
            <a className="btn btn-or btn-lg" href="#talepler">Alıcıları gör</a>
            <Link className="btn btn-wh btn-lg" href="/bana-ozel?s=alarm">Alıcı gelince haber ver</Link>
          </> : <>
            <Link className="btn btn-or btn-lg" href={p.talepHref}>Ücretsiz talep ver</Link>
            <a className="btn btn-wh btn-lg" href="#talepler">Diğer talepleri gör</a>
          </>}
        </div>
      </section>

      <section className="lp-stats" aria-label="Rakamlarla">
        <div><b>{s ? fmt(s.count) : "–"}</b><small>{where}açık talep</small></div>
        <div><b>{s?.avg_budget ? `${fmt(s.avg_budget)} TL` : "–"}</b><small>ortalama bütçe</small></div>
        <div><b>{s?.max_budget ? `${fmt(s.max_budget)} TL` : "–"}</b><small>en yüksek bütçe</small></div>
        <div><b>{s ? fmt(s.ever) : "–"}</b><small>bugüne kadarki talep</small></div>
      </section>
      {s && s.cities.length > 0 && !p.place && (
        <p className="il-intro">En çok {s.cities.slice(0, 5).map((c) => c.city).join(", ")} illerinde {p.n} aranıyor.</p>
      )}

      <section className="box" id="talepler" style={{ marginBottom: 14 }}>
        <div className="box-h"><h2>{p.kind === "sat" ? `${where}${cap(p.n)} almak isteyen alıcılar` : `${where}${cap(p.n)} arayan diğer alıcılar`}</h2><Link className="link" href={p.listHref}>Tümünü gör ›</Link></div>
        <RequestTable items={p.items} empty={p.kind === "sat"
          ? `Şu an ${where}açık talep yok. Alarm kurun; ${p.n} almak isteyen alıcı gelince size haber verelim.`
          : `Şu an ${where}açık talep yok. İlk talebi siz verin; satıcıların ilk göreceği talep sizinki olur.`} />
        <div className="box-b il-cta">
          {p.kind === "sat" ? <Link className="btn btn-or" href="/bana-ozel?s=alarm">Talep alarmı kur</Link> : <Link className="btn btn-or" href={p.talepHref}>Ücretsiz talep ver</Link>}
          <Link className="btn btn-bl" href={p.listHref}>Tüm talepler</Link>
        </div>
      </section>

      <section className="box lp-steps" style={{ marginBottom: 14 }}>
        <div className="box-h"><h2>{p.kind === "sat" ? `${cap(p.acc)} 3 adımda satın` : "3 adımda sahibinden bulun"}</h2></div>
        <ol className="box-b">{steps.map(([t, d], i) => <li key={t}><span className="lp-n">{i + 1}</span><div><b>{t}</b><p>{d}</p></div></li>)}</ol>
      </section>

      {p.groups.filter((g) => g.links.length).map((g) => (
        <section key={g.title} className="box" style={{ marginBottom: 14 }}>
          <div className="box-h"><h2>{g.title}</h2></div>
          <div className="box-b chips">{g.links.map((l) => <Link key={l.href} className="chip" href={l.href}>{l.label}{l.n ? <span className="muted"> ({fmt(l.n)})</span> : null}</Link>)}</div>
        </section>
      ))}

      {p.faq.length > 0 && (
        <section className="box lp-faq" style={{ marginBottom: 14 }}>
          <div className="box-h"><h2>Sık sorulan sorular</h2></div>
          <div className="box-b">{p.faq.map(([q, a]) => <details key={q} className="faq-item"><summary>{q}</summary><div className="faq-a"><p>{a}</p></div></details>)}</div>
        </section>
      )}
    </div>
  );
}

export const cap = (s: string) => s.charAt(0).toLocaleUpperCase("tr") + s.slice(1);
