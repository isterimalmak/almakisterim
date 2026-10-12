"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { RequestTable } from "@/components/RequestTable";
import { useSession } from "@/components/Session";
import { api, type RequestItem } from "@/lib/api";
import { ATTRS, CITIES, CONDS } from "@/lib/catalog";

type F = { q: string; city: string; bmin: string; bmax: string; cond: string[]; attrs: Record<string, string[]>; urgent: boolean; noOffers: boolean; buyer: "" | "bireysel" | "kurumsal"; sort: string; page: number };
const PER = 20;

function Listing() {
  const { slug = [] } = useParams<{ slug?: string[] }>();
  const sp = useSearchParams();
  const { categories, user, toast } = useSession();
  const [top, sub] = slug;
  const t = categories.find((c) => c.id === top);
  const s = t?.subs.find((x) => x.id === sub);
  const initial = (): F => ({ q: sp.get("q") ?? "", city: "", bmin: "", bmax: "", cond: [], attrs: {}, urgent: sp.get("acil") === "1", noOffers: sp.get("teklifsiz") === "1", buyer: (sp.get("buyer") as F["buyer"]) ?? "", sort: "new", page: 1 });
  const [f, setF] = useState<F>(initial);
  const [data, setData] = useState<{ total: number; items: RequestItem[] } | null>(null);
  const [openFilters, setOpenFilters] = useState(false);
  useEffect(() => setF(initial()), [top, sub, sp]); // eslint-disable-line react-hooks/exhaustive-deps

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (top) p.set("top", top);
    if (sub) p.set("sub", sub);
    if (f.q.trim()) p.set("q", f.q.trim());
    if (f.city) p.set("city", f.city);
    if (f.bmin) p.set("bmin", f.bmin);
    if (f.bmax) p.set("bmax", f.bmax);
    if (f.cond.length) p.set("cond", f.cond.join(","));
    for (const [k, v] of Object.entries(f.attrs)) if (v.length) p.set(`a_${k}`, v.join(","));
    if (f.urgent) p.set("urgent", "1");
    if (f.noOffers) p.set("no_offers", "1");
    if (f.buyer) p.set("buyer", f.buyer);
    p.set("sort", f.sort);
    p.set("page", String(f.page));
    p.set("per", String(PER));
    return p.toString();
  }, [top, sub, f]);

  useEffect(() => {
    const h = setTimeout(() => { void api<{ total: number; items: RequestItem[] }>(`/requests?${qs}`).then(setData).catch(() => setData({ total: 0, items: [] })); }, 250);
    return () => clearTimeout(h);
  }, [qs]);

  const set = (patch: Partial<F>) => setF((x) => ({ ...x, page: 1, ...patch }));
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const title = s ? `${s.name} Alım Talepleri` : t ? `${t.name} Alım Talepleri` : f.q ? `"${f.q}" için talepler` : "Tüm Alım Talepleri";
  const pages = data ? Math.max(1, Math.ceil(data.total / PER)) : 1;
  const selAttrs = (t && ATTRS[t.id]?.filter((a) => a.t === "sel")) ?? [];

  const saveAlarm = async () => {
    if (!user) { toast("Alarm kurmak için giriş yapın."); return; }
    try {
      await api("/me/alarms", { body: { category_id: sub ?? top ?? categories[0]?.id, city: f.city, min_budget: Number(f.bmin) || 0 } });
      toast("Arama kaydedildi. Uygun yeni talep gelince bildirim alacaksınız.");
    } catch (e) { toast((e as Error).message); }
  };

  if (top && categories.length && !t) return <div className="wrap"><div className="crumb"><Link href="/">Ana Sayfa</Link></div><div className="box"><div className="empty">Bu kategori şu anda yayında değil.</div></div></div>;

  return (
    <div className="wrap">
      <div className="crumb"><Link href="/">Ana Sayfa</Link> › <Link href="/kategori">Talepler</Link>{t && <> › <Link href={`/kategori/${t.id}`}>{t.name}</Link></>}{s && <> › {s.name}</>}</div>
      <div className="list-head"><h1>{title}</h1><button className="btn btn-wh btn-sm flt-toggle" onClick={() => setOpenFilters((o) => !o)}>Filtrele</button></div>
      <div className="listing">
        <aside className={"flt" + (openFilters ? " open" : "")}>
          <div className="flt-sec flt-cats">
            <h4>Kategori</h4>
            {t ? (
              <>
                <Link href="/kategori">« Tüm kategoriler</Link>
                <Link href={`/kategori/${t.id}`} className={!sub ? "on" : ""}><span>{t.name}</span><span className="n">{t.active_count}</span></Link>
                {t.subs.map((x) => <Link key={x.id} href={`/kategori/${t.id}/${x.id}`} className={sub === x.id ? "on" : ""} style={{ paddingLeft: 10 }}><span>{x.name}</span><span className="n">{x.active_count}</span></Link>)}
              </>
            ) : categories.map((x) => <Link key={x.id} href={`/kategori/${x.id}`}><span>{x.name}</span><span className="n">{x.active_count}</span></Link>)}
          </div>
          <div className="flt-sec"><h4>Kelime</h4><input className="inp" value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="Talepte ara" /></div>
          <div className="flt-sec"><h4>Adres</h4><select className="sel" value={f.city} onChange={(e) => set({ city: e.target.value })} aria-label="İl"><option value="">Tüm iller</option>{CITIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div className="flt-sec"><h4>Alıcının bütçesi (TL)</h4><div className="mm"><input className="inp" type="number" placeholder="en az" value={f.bmin} onChange={(e) => set({ bmin: e.target.value })} aria-label="Bütçe en az" /><input className="inp" type="number" placeholder="en çok" value={f.bmax} onChange={(e) => set({ bmax: e.target.value })} aria-label="Bütçe en çok" /></div></div>
          <div className="flt-sec"><h4>Ürün durumu</h4>{CONDS.map((c) => <label className="chk" key={c}><input type="checkbox" checked={f.cond.includes(c)} onChange={() => set({ cond: toggle(f.cond, c) })} />{c}</label>)}</div>
          {selAttrs.map((a) => (
            <div className="flt-sec" key={a.k}><h4>{a.l}</h4>
              {a.o!.map((o) => <label className="chk" key={o}><input type="checkbox" checked={(f.attrs[a.k] ?? []).includes(o)} onChange={() => set({ attrs: { ...f.attrs, [a.k]: toggle(f.attrs[a.k] ?? [], o) } })} />{o}</label>)}
            </div>
          ))}
          <div className="flt-sec">
            <label className="chk"><input type="checkbox" checked={f.urgent} onChange={(e) => set({ urgent: e.target.checked })} />Sadece acil talepler</label>
            <label className="chk"><input type="checkbox" checked={f.noOffers} onChange={(e) => set({ noOffers: e.target.checked })} />Henüz teklif almamış</label>
            <button className="btn btn-wh btn-sm" style={{ marginTop: 8 }} onClick={() => setF({ ...initial(), q: "", urgent: false, noOffers: false, buyer: "" })}>Filtreleri temizle</button>
          </div>
        </aside>
        <div>
          <div className="res-bar">
            <div className="tabs">
              {([["", "Tüm Talepler"], ["bireysel", "Bireysel"], ["kurumsal", "Kurumsal"]] as const).map(([v, l]) => <button key={v} className={f.buyer === v ? "on" : ""} onClick={() => set({ buyer: v })}>{l}</button>)}
            </div>
            <div className="res-tools">
              <button className="link save-alarm" onClick={saveAlarm}>Aramayı kaydet</button>
              <select className="sel" value={f.sort} onChange={(e) => set({ sort: e.target.value })} aria-label="Sıralama">
                <option value="new">Tarih (önce en yeni)</option><option value="old">Tarih (önce en eski)</option>
                <option value="budget_desc">Bütçe (yüksekten düşüğe)</option><option value="budget_asc">Bütçe (düşükten yükseğe)</option>
                <option value="few_offers">Teklif sayısı (önce en az)</option><option value="ending">Bitişe kalan süre</option>
              </select>
            </div>
          </div>
          <div className="tbl-wrap">
            <div style={{ padding: "8px 10px", fontSize: 12.5, background: "#fff", borderBottom: "1px solid var(--line-2)" }}><b>{data?.total ?? "…"}</b> talep bulundu</div>
            {!data ? <div className="loading">Yükleniyor…</div> : <RequestTable items={data.items} />}
          </div>
          {pages > 1 && <div className="pager">{Array.from({ length: Math.min(pages, 20) }, (_, i) => <button key={i} className={f.page === i + 1 ? "on" : ""} onClick={() => { setF((x) => ({ ...x, page: i + 1 })); window.scrollTo(0, 0); }}>{i + 1}</button>)}</div>}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="loading">Yükleniyor…</div>}><Listing /></Suspense>;
}
