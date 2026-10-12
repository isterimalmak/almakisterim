"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { RequestTable, VitrinCard } from "@/components/RequestTable";
import { useSession } from "@/components/Session";
import { api, type RequestItem } from "@/lib/api";

type List = { total: number; items: RequestItem[] };

export default function Home() {
  const { categories } = useSession();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [urgent, setUrgent] = useState<List | null>(null);
  const [latest, setLatest] = useState<List | null>(null);
  const [corp, setCorp] = useState<List | null>(null);
  const [noOffer, setNoOffer] = useState<number | null>(null);

  useEffect(() => {
    void api<List>("/requests?urgent=1&per=8").then(setUrgent).catch(() => setUrgent({ total: 0, items: [] }));
    void api<List>("/requests?per=10").then(setLatest).catch(() => setLatest({ total: 0, items: [] }));
    void api<List>("/requests?buyer=kurumsal&per=5").then(setCorp).catch(() => setCorp({ total: 0, items: [] }));
    void api<List>("/requests?no_offers=1&per=1").then((r) => setNoOffer(r.total)).catch(() => setNoOffer(0));
  }, []);

  return (
    <div className="wrap home">
      <aside className="ctree" aria-label="Kategoriler">
        {categories.map((t) => (
          <div className="ct-group" key={t.id}>
            <Link className="ct-top" href={`/kategori/${t.id}`}><span className="ct-ic"><Icon name={t.icon} /></span>{t.name} <span className="n">({t.active_count})</span></Link>
            <ul className="ct-subs">
              {t.subs.map((s) => <li key={s.id}><Link href={`/kategori/${t.id}/${s.id}`}><span>{s.name}</span><span className="n">{s.active_count}</span></Link></li>)}
            </ul>
          </div>
        ))}
      </aside>

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

        <section className="box" style={{ marginBottom: 14 }}>
          <div className="box-h"><h2>Acil Alım Talepleri</h2><Link className="link" href="/kategori?acil=1">Tüm acil talepler ({urgent?.total ?? 0}) »</Link></div>
          <div className="box-b">
            {!urgent ? <div className="loading">Yükleniyor…</div> : urgent.items.length ? <div className="vitrin">{urgent.items.map((r) => <VitrinCard key={r.id} r={r} />)}</div> : <div className="muted">Şu an acil talep yok.</div>}
          </div>
        </section>

        <section className="box" style={{ marginBottom: 14 }}>
          <div className="box-h"><h2>Son Eklenen Talepler</h2><Link className="link" href="/kategori">Tüm talepler ({latest?.total ?? 0}) »</Link></div>
          {!latest ? <div className="loading">Yükleniyor…</div> : <RequestTable items={latest.items} empty="Henüz talep yok. İlk talebi siz verin!" />}
        </section>

        {!!corp?.items.length && (
          <section className="box">
            <div className="box-h"><h2>Kurumsal Alım Talepleri</h2><Link className="link" href="/kategori?buyer=kurumsal">Tümü »</Link></div>
            <RequestTable items={corp.items} />
          </section>
        )}
      </div>

      <aside className="side">
        <div className="box seller-cta"><div className="box-b">
          <div className="big">{noOffer ?? "–"}</div>
          <div style={{ fontWeight: 700, margin: "4px 0 2px" }}>talep henüz hiç teklif almadı</div>
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>İlk teklifi veren satıcı alıcının dikkatini ilk çeken olur.</p>
          <Link className="btn btn-or btn-block" href="/kategori?teklifsiz=1">Teklif bekleyen talepler</Link>
        </div></div>
        <div className="box"><div className="box-h"><h3>Nasıl çalışır?</h3></div><div className="box-b"><ol className="steps">
          <li><div><b>Talebinizi yazın</b><span className="muted">Ne aradığınızı ve bütçenizi bir cümleyle yazın.</span></div></li>
          <li><div><b>Teklifler gelsin</b><span className="muted">Uygun satıcılara bildirim gider, teklifler size ulaşır.</span></div></li>
          <li><div><b>Karşılaştırın, seçin</b><span className="muted">Fiyata ve satıcıya bakıp birini kabul edin.</span></div></li>
        </ol></div></div>
        <div className="box"><div className="box-h"><h3>Güvenli alışveriş</h3></div><div className="box-b" style={{ fontSize: 12.5 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}><Icon name="lock" size={16} sw={2} /><span>Telefon numaranız satıcılara gösterilmez. İletişim site içinden başlar.</span></div>
          <div style={{ display: "flex", gap: 8 }}><Icon name="check" size={16} sw={2} /><span>Kapora göndermeyin, ürünü görmeden ödeme yapmayın.</span></div>
        </div></div>
      </aside>
    </div>
  );
}
