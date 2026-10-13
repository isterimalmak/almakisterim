"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Ads } from "@/components/Ads";
import { CatIcon, RequestTable, VitrinCard, VitrinTile } from "@/components/RequestTable";
import { useSession } from "@/components/Session";
import { api, type RequestItem } from "@/lib/api";

type List = { total: number; items: RequestItem[] };

export default function Home() {
  const { categories, browseCategories, count, launchMode } = useSession();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [urgent, setUrgent] = useState<List | null>(null);
  const [latest, setLatest] = useState<List | null>(null);
  const [vitrin, setVitrin] = useState<List | null>(null);
  const [corp, setCorp] = useState<List | null>(null);
  const [noOffer, setNoOffer] = useState<number | null>(null);

  useEffect(() => {
    void api<List>("/requests?urgent=1&per=8").then(setUrgent).catch(() => setUrgent({ total: 0, items: [] }));
    void api<List>("/requests?sort=vitrin&per=20").then(setVitrin).catch(() => setVitrin({ total: 0, items: [] }));
    void api<List>("/requests?per=10").then(setLatest).catch(() => setLatest({ total: 0, items: [] }));
    void api<List>("/requests?buyer=kurumsal&per=5").then(setCorp).catch(() => setCorp({ total: 0, items: [] }));
    void api<List>("/requests?no_offers=1&per=1").then((r) => setNoOffer(r.total)).catch(() => setNoOffer(0));
  }, []);

  return (
    <div className="wrap home">
      <div className="home-left">
      <aside className="ctree" aria-label="Kategoriler">
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
          <div>
            <h1>Burada ilanı alıcı verir, satıcılar teklif verir.</h1>
            <p>Ne almak istediğinizi ve bütçenizi yazın. Uygun satıcılar size teklif göndersin, siz en iyisini seçin. Talep vermek ücretsizdir.</p>
            <form className="quick" onSubmit={(e) => { e.preventDefault(); router.push(`/talep-ver${q.trim() ? `?metin=${encodeURIComponent(q.trim())}` : ""}`); }}>
              <div className="quick-in">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Örn. 2. el iPhone 13 almak istiyorum, bütçem 20.000 TL" aria-label="Ne almak istiyorsunuz?" />
                <button type="submit">Talep Oluştur</button>
              </div>
            </form>
          </div>
          <Link className="btn btn-wh" href="/bana-ozel?s=eslesme">Satıcıyım, talepleri gör</Link>
        </section>

        {!!urgent?.items.length && (
          <section className="box" style={{ marginBottom: 14 }}>
            <div className="box-h"><h2>Acil Alım Talepleri</h2><Link className="link" href="/kategori?acil=1">Tüm acil talepler{count(urgent.total) !== null && ` (${urgent.total})`} »</Link></div>
            <div className="box-b"><div className="vitrin">{urgent.items.map((r) => <VitrinCard key={r.id} r={r} />)}</div></div>
          </section>
        )}

        {/* Telefonda soldaki liste gizli; kategoriler renkli kutucuklar olarak burada. */}
        <section className="cat-tiles" aria-label="Kategoriler">
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
        {!!noOffer && (
          <div className="box seller-cta"><div className="box-b">
            <div className="big">{noOffer}</div>
            <div style={{ fontWeight: 700, margin: "4px 0 2px" }}>talep henüz satıcı bekliyor</div>
            <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>Alıcıya ilk ulaşan satıcı dikkatini ilk çeken olur.</p>
            <Link className="btn btn-or btn-block" href="/kategori?teklifsiz=1">Teklif bekleyen talepler</Link>
          </div></div>
        )}
        <div className="box"><div className="box-h"><h3>Nasıl çalışır?</h3></div><div className="box-b"><ol className="steps">
          <li><div><b>Talebinizi yazın</b><span className="muted">Ne aradığınızı ve bütçenizi bir cümleyle yazın.</span></div></li>
          <li><div><b>Satıcılar size ulaşsın</b><span className="muted">Uygun satıcılara bildirim gider; sizi arar veya teklif gönderirler.</span></div></li>
          <li><div><b>Karşılaştırın, seçin</b><span className="muted">Fiyata ve satıcıya bakıp birini kabul edin.</span></div></li>
        </ol></div></div>
        <div className="box"><div className="box-h"><h3>Güvenli alışveriş</h3></div><div className="box-b" style={{ fontSize: 12.5 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}><Icon name="lock" size={16} sw={2} /><span>Numaranız herkese açık değildir; yalnızca talebinizle ilgilenen sınırlı sayıda satıcı görür. İstediğiniz an gizleyebilirsiniz.</span></div>
          <div style={{ display: "flex", gap: 8 }}><Icon name="check" size={16} sw={2} /><span>Kapora göndermeyin, ürünü görmeden ödeme yapmayın.</span></div>
        </div></div>
      </aside>
    </div>
  );
}
