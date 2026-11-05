"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useSession } from "@/components/Session";
import { fmt } from "@/lib/format";

type Row = { name: string; count: number };
type Data = {
  tracking: { ga4_id: string; gsc: string; bing: string };
  report: { days: number; total: number; organic: number; direct: number; engines: Row[]; ai: Row[]; landings: Row[]; categories: Row[]; others: Row[] };
};

// Yönetim → SEO ve Ölçüm: Google Analytics ve arama motoru doğrulama kodları, Google'dan gelenlerin verdiği talepler.
// Sıralama ve tıklama verisi Search Console'da, ziyaretçi sayısı Analytics'te görülür; burada talep verme (dönüşüm) ölçülür.
export function SeoAdmin() {
  const { toast } = useSession();
  const [d, setD] = useState<Data | null>(null);
  const [f, setF] = useState({ ga4_id: "", gsc: "", bing: "" });
  const [days, setDays] = useState(30);
  useEffect(() => {
    void api<Data>(`/admin/seo?days=${days}`).then((x) => { setD(x); setF(x.tracking); }).catch((e) => toast((e as Error).message));
  }, [days]); // eslint-disable-line react-hooks/exhaustive-deps
  // "content" değerinin yerine etiketin tamamı yapıştırıldıysa içinden değer alınır.
  const clean = (v: string) => (/content="([^"]+)"/.exec(v)?.[1] ?? v).trim();
  const save = async () => {
    try {
      const r = await api<{ tracking: Data["tracking"] }>("/admin/seo", { method: "PUT", body: { ga4_id: f.ga4_id.trim(), gsc: clean(f.gsc), bing: clean(f.bing) } });
      setF(r.tracking);
      toast("Kaydedildi. Doğrulama kodu sitenin bütün sayfalarına eklendi.");
    } catch (e) { toast((e as Error).message); }
  };
  const r = d?.report;
  const pct = (n: number) => (r?.total ? `%${Math.round((n / r.total) * 100)}` : "–");
  const table = (title: string, rows: Row[] | undefined, empty: string) => (
    <div className="box" style={{ marginBottom: 12 }}>
      <div className="box-h"><h3>{title}</h3></div>
      {rows?.length ? <table className="tbl"><tbody>{rows.map((x) => <tr key={x.name}><td>{x.name}</td><td style={{ textAlign: "right", width: 90 }}><b>{fmt(x.count)}</b></td></tr>)}</tbody></table>
        : <div className="empty">{empty}</div>}
    </div>
  );
  return (
    <section aria-label="SEO ve Ölçüm">
      <div className="box" style={{ marginBottom: 14 }}>
        <div className="box-h"><h2>Google bağlantıları</h2></div>
        <div className="box-b form-grid">
          <div className="fg full"><label htmlFor="seo-ga">Google Analytics 4 ölçüm kimliği</label>
            <input id="seo-ga" className="inp" placeholder="G-XXXXXXXXXX" value={f.ga4_id} onChange={(e) => setF({ ...f, ga4_id: e.target.value })} />
            <span className="hint">analytics.google.com → Yönetici → Veri akışları → sitenizi seçin → "Ölçüm kimliği". Ziyaretçi yalnızca çerez kutusunda "Kabul et" derse çalışır.</span></div>
          <div className="fg full"><label htmlFor="seo-gsc">Google Search Console doğrulama kodu</label>
            <input id="seo-gsc" className="inp" placeholder='content="…" içindeki değer' value={f.gsc} onChange={(e) => setF({ ...f, gsc: e.target.value })} />
            <span className="hint">search.google.com/search-console → Mülk ekle → "URL ön eki" → https://almakisterim.com → Doğrulama yöntemi "HTML etiketi". Etiketin tamamını da yapıştırabilirsiniz.</span></div>
          <div className="fg full"><label htmlFor="seo-bing">Bing Webmaster doğrulama kodu</label>
            <input id="seo-bing" className="inp" placeholder='content="…" içindeki değer' value={f.bing} onChange={(e) => setF({ ...f, bing: e.target.value })} />
            <span className="hint">bing.com/webmasters → Site ekle → "HTML Meta Etiketi". ChatGPT ve Copilot aramaları Bing'i kullanır.</span></div>
          <div className="fg full"><button type="button" className="btn btn-or" onClick={() => void save()}>Kaydet</button></div>
        </div>
      </div>

      <div className="box-h" style={{ marginBottom: 8 }}>
        <h2>Arama motorlarından gelen talepler</h2>
        <div className="seg" role="group" aria-label="Dönem">{[7, 30, 90].map((n) => <button key={n} type="button" className={days === n ? "on" : ""} aria-pressed={days === n} onClick={() => setDays(n)}>Son {n} gün</button>)}</div>
      </div>
      <div className="lp-stats">
        <div><b>{r ? fmt(r.total) : "–"}</b><small>verilen talep</small></div>
        <div><b>{r ? fmt(r.organic) : "–"}</b><small>arama motorundan gelen ({pct(r?.organic ?? 0)})</small></div>
        <div><b>{r ? fmt(r.ai.reduce((n, x) => n + x.count, 0)) : "–"}</b><small>yapay zekâ sohbetinden</small></div>
        <div><b>{r ? fmt(r.direct) : "–"}</b><small>doğrudan ya da bilinmiyor</small></div>
      </div>
      <p className="muted" style={{ fontSize: 12.5 }}>Yalnız çerez kutusunda "Kabul et" diyen ziyaretçilerin geldiği yer bilinir; reddedenler "doğrudan ya da bilinmiyor" sayılır.</p>
      {table("Talep getiren ilk sayfalar (arama motorundan)", r?.landings, "Henüz arama motorundan gelen bir ziyaretçi talep vermedi.")}
      {table("Arama motorları", r?.engines, "Henüz yok.")}
      {table("Kategoriler (arama motorundan gelen talepler)", r?.categories, "Henüz yok.")}
      {table("Yapay zekâ sohbetleri", r?.ai, "Henüz yok.")}
      {table("Diğer siteler", r?.others, "Henüz yok.")}

      <div className="box">
        <div className="box-h"><h3>Sıralama ve kelimeler nerede görülür?</h3></div>
        <div className="box-b">
          <p><b>Hangi kelimelerde kaçıncı sıradayız, kaç kişi tıkladı:</b> <a className="link" href="https://search.google.com/search-console/performance/search-analytics?resource_id=sc-domain%3Aalmakisterim.com" target="_blank" rel="noopener noreferrer">Search Console → Performans</a></p>
          <p><b>Günlük ve aylık ziyaretçi, Google'dan gelenler, talep verenler:</b> <a className="link" href="https://analytics.google.com/" target="_blank" rel="noopener noreferrer">Google Analytics</a> → Raporlar → Edinme → Trafik edinme ("Organic Search"). Talep verme "talep_olusturuldu" olayı olarak gelir; Yönetici → Etkinlikler'den "Önemli etkinlik" olarak işaretleyin.</p>
        </div>
      </div>
    </section>
  );
}
