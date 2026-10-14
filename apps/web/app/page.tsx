"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Ads } from "@/components/Ads";
import { Welcome } from "@/components/Welcome";
import { CatIcon, RequestTable, VitrinCard, VitrinTile } from "@/components/RequestTable";
import { useSession } from "@/components/Session";
import { api, type RequestItem } from "@/lib/api";

type List = { total: number; items: RequestItem[] };

// Ana sayfadaki hızlı talep kutusunda sırayla değişen örnekler (şimdilik vasıta ve emlak).
const HERO_EXAMPLES = [
  "2018 model dizel Passat",
  "Kadıköy'de 3+1 kiralık daire",
  "Az kilometreli otomatik Clio",
  "Urla'da 500 m² imarlı arsa",
];

export default function Home() {
  const { categories, browseCategories, count, launchMode, homeUrgentBox } = useSession();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [ex, setEx] = useState(0);
  // Kutu boşken örnek 4 saniyede bir değişir.
  useEffect(() => { if (q) return; const t = setInterval(() => setEx((i) => (i + 1) % HERO_EXAMPLES.length), 4000); return () => clearInterval(t); }, [q]);
  const [urgent, setUrgent] = useState<List | null>(null);
  const [latest, setLatest] = useState<List | null>(null);
  const [vitrin, setVitrin] = useState<List | null>(null);
  const [corp, setCorp] = useState<List | null>(null);

  useEffect(() => {
    void api<List>("/requests?urgent=1&per=8").then(setUrgent).catch(() => setUrgent({ total: 0, items: [] }));
    void api<List>("/requests?sort=vitrin&per=20").then(setVitrin).catch(() => setVitrin({ total: 0, items: [] }));
    void api<List>("/requests?per=10").then(setLatest).catch(() => setLatest({ total: 0, items: [] }));
    void api<List>("/requests?buyer=kurumsal&per=5").then(setCorp).catch(() => setCorp({ total: 0, items: [] }));
  }, []);

  return (
    <div className="wrap home">
      <Welcome />
      <div className="home-left">
      <aside className="ctree" aria-label="Kategoriler">
        {/* sahibinden'deki gibi: acil talepler kategorilerin üstünde ayrı bir bağlantı */}
        {!!urgent?.total && (
          <div className="ct-group ct-quick">
            <Link className="ct-top" href="/kategori?acil=1"><span className="ct-ic ct-acil" aria-hidden="true"><Icon name="bolt" size={16} sw={2.2} /></span>Acil Talepler {count(urgent.total) !== null && <span className="n">({urgent.total})</span>}</Link>
          </div>
        )}
        {browseCategories.length ? browseCategories.map((t) => (
          <div className="ct-group" key={t.id}>
            <Link className="ct-top" href={`/kategori/${t.id}`}><CatIcon top={t.id} cls="ct-ic" />{t.name} {count(t.active_count) !== null && <span className="n">({t.active_count})</span>}</Link>
            <ul className="ct-subs">
              {t.subs.map((s) => <li key={s.id}><Link href={`/kategori/${t.id}/${s.id}`}><span>{s.name}</span><span className="n">{count(s.active_count)}</span></Link></li>)}
            </ul>
          </div>
        )) : (
          // Henüz gezilecek talep yoksa kategoriler "ne almak istiyorsunuz?" kısayolu olur.
          <div className="ct-group">
            <div className="ct-top" style={{ cursor: "default" }}>Ne almak istiyorsunuz?</div>
            <ul className="ct-subs ct-pick">{categories.map((t) => <li key={t.id}><Link href={`/talep-ver?kategori=${t.id}`}><CatIcon top={t.id} cls="ct-ic" /><span>{t.name}</span><span className="ar">›</span></Link></li>)}</ul>
          </div>
        )}
      </aside>
      <Ads />
      </div>

      <div>
        <section className="concept">
          <h1>Burada ilanı alıcı verir, satıcı alıcıyı bulur.</h1>
          <p>Almak istediğinizi yazın, satıcılar sizi arasın veya mesaj atsın. Satıyorsanız alıcıları listeleyin, ulaşın.</p>
          <div className="hero-row">
            <form className="quick" onSubmit={(e) => { e.preventDefault(); router.push(`/talep-ver${q.trim() ? `?metin=${encodeURIComponent(q.trim())}` : ""}`); }}>
              <div className="quick-in">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Örn. ${HERO_EXAMPLES[ex]}`} aria-label="Ne almak istiyorsunuz?" />
                <button type="submit">Talep Oluştur</button>
              </div>
              <p className="hero-ai"><span aria-hidden="true">✨</span> Tek cümleyle yazın; yapay zekâ kategoriyi, bütçeyi ve konumu sizin için doldursun.</p>
            </form>
            <span className="hero-or">veya</span>
            <Link className="btn btn-sell" href="/kategori">Satmak İstiyorum, Alıcıları Gör!</Link>
          </div>
        </section>

        {homeUrgentBox && !!urgent?.items.length && (
          <section className="box" style={{ marginBottom: 14 }}>
            <div className="box-h"><h2>Acil Alım Talepleri</h2><Link className="link" href="/kategori?acil=1">Tüm acil talepler{count(urgent.total) !== null && ` (${urgent.total})`} »</Link></div>
            <div className="box-b"><div className="vitrin">{urgent.items.map((r) => <VitrinCard key={r.id} r={r} />)}</div></div>
          </section>
        )}

        {/* Telefonda soldaki liste gizli; kategoriler renkli kutucuklar olarak burada. */}
        <section className="cat-tiles" aria-label="Kategoriler">
          {!!urgent?.total && <Link href="/kategori?acil=1" className="ct-acil-tile"><span className="ct-ic ct-acil" aria-hidden="true"><Icon name="bolt" size={16} sw={2.2} /></span><span>Acil Talepler</span></Link>}
          {(browseCategories.length ? browseCategories : categories).map((t) => (
            <Link key={t.id} href={browseCategories.length ? `/kategori/${t.id}` : `/talep-ver?kategori=${t.id}`}><CatIcon top={t.id} cls="ct-ic" /><span>{t.name}</span></Link>
          ))}
        </section>

        <Ads cls="yk-m" />

        {!!vitrin?.items.length && (
          <section className="box" style={{ marginBottom: 14 }}>
            <div className="box-h"><h2>Ana Sayfa Vitrini</h2><Link className="link" href="/kategori">Tüm talepleri göster »</Link></div>
            <div className="box-b"><div className="vt">{vitrin.items.map((r) => <VitrinTile key={r.id} r={r} />)}</div></div>
          </section>
        )}

        <section className="box" style={{ marginBottom: 14 }}>
          <div className="box-h"><h2>Son Eklenen Talepler</h2>{!!latest?.total && <Link className="link" href="/kategori">Tüm talepler{count(latest.total) !== null && ` (${latest.total})`} »</Link>}</div>
          {!latest ? <div className="loading">Yükleniyor…</div> : latest.items.length ? <RequestTable items={latest.items} /> : (
            <div className="soon"><div className="soon-grid">
              <div><b>İlk talepler geliyor</b><p>Almak istediğinizi yazın; ilk talep sahipleri satıcıların en çok ilgisini çeker.</p><Link className="btn btn-or" href="/talep-ver">Ücretsiz talep ver</Link></div>
              <div><b>Satıcı mısınız?</b><p>Hangi kategoride ve ilde satış yaptığınızı seçin, talep gelince SMS ile haber verelim.</p><Link className="btn btn-bl" href="/bana-ozel?s=alarm">Talep alarmı kur</Link></div>
            </div></div>
          )}
        </section>

        {!!corp?.items.length && (
          <section className="box">
            <div className="box-h"><h2>Kurumsal Alım Talepleri</h2><Link className="link" href="/kategori?buyer=kurumsal">Tümü »</Link></div>
            <RequestTable items={corp.items} />
          </section>
        )}
      </div>

      <aside className="side">
        {launchMode && (
          <div className="box launch"><div className="box-b">
            <b>Lansman dönemi: numara görmek ücretsiz!</b>
            <p>Satıcılar şimdilik alıcıların numarasını kredi harcamadan görebilir. Erken katılan satıcılar ilk müşterileri kapar.</p>
            <Link className="btn btn-or btn-block" href="/bana-ozel?s=alarm">Talep gelince haber ver</Link>
          </div></div>
        )}
        <div className="box"><div className="box-h"><h3>Nasıl çalışır?</h3></div><div className="box-b"><ol className="steps">
          <li><div><b>Talebinizi yazın</b><span className="muted">Ne aradığınızı ve bütçenizi bir cümleyle yazın.</span></div></li>
          <li><div><b>Satıcılar size ulaşsın</b><span className="muted">Elinde uygun ürün olan satıcılar sizi arar veya mesaj atar.</span></div></li>
          <li><div><b>Anlaşın</b><span className="muted">Satıcıyla konuşun, ürünü görün; aldığınızda talebinizi kapatın.</span></div></li>
        </ol></div></div>
        <div className="box"><div className="box-h"><h3>Güvenli alışveriş</h3></div><div className="box-b" style={{ fontSize: 12.5 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}><Icon name="lock" size={16} sw={2} /><span>Numaranız herkese açık değildir; yalnızca talebinizle ilgilenen sınırlı sayıda satıcı görür. İstediğiniz an gizleyebilirsiniz.</span></div>
          <div style={{ display: "flex", gap: 8 }}><Icon name="check" size={16} sw={2} /><span>Kapora göndermeyin, ürünü görmeden ödeme yapmayın.</span></div>
        </div></div>
      </aside>
    </div>
  );
}
