"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { RequestTable } from "@/components/RequestTable";
import { useSession } from "@/components/Session";
import { api, type RequestItem } from "@/lib/api";
import { fmt } from "@/lib/format";
import { attrsFor, CITIES, condsFor } from "@/lib/catalog";
import { useDistricts, useNeighbourhoods } from "@/lib/locations";
import { useVehicleCatalog } from "@/lib/vehicles";

type Veh = { marka: string; model: string; yil: string; km: string; yakit: string; vites: string };
const NO_VEH: Veh = { marka: "", model: "", yil: "", km: "", yakit: "", vites: "" };
type F = { veh: Veh; q: string; city: string; district: string; hood: string; bmin: string; bmax: string; cond: string[]; attrs: Record<string, string[]>; urgent: boolean; noOffers: boolean; buyer: "" | "bireysel" | "kurumsal"; sort: string; page: number };
const PER = 20;

// Sayfa numaraları kısaltılır: 1 … 4 5 6 … 12 (0 = üç nokta). Telefonda sığsın diye en fazla 7 öğe.
function pageList(cur: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const from = Math.max(2, Math.min(cur - 1, total - 4)), to = Math.min(total - 1, Math.max(cur + 1, 5));
  return [1, ...(from > 2 ? [0] : []), ...Array.from({ length: to - from + 1 }, (_, i) => from + i), ...(to < total - 1 ? [0] : []), total];
}

function Listing() {
  const { slug = [] } = useParams<{ slug?: string[] }>();
  const sp = useSearchParams();
  const { categories, browseCategories, count, user, toast } = useSession();
  const [top, sub] = slug;
  const t = categories.find((c) => c.id === top);
  const s = t?.subs.find((x) => x.id === sub);
  const initial = (): F => ({ veh: NO_VEH, q: sp.get("q") ?? "", city: "", district: "", hood: "", bmin: "", bmax: "", cond: [], attrs: {}, urgent: sp.get("acil") === "1", noOffers: sp.get("teklifsiz") === "1", buyer: (sp.get("buyer") as F["buyer"]) ?? "", sort: "new", page: 1 });
  const [f, setF] = useState<F>(initial);
  const districts = useDistricts(f.city);
  const hoods = useNeighbourhoods(f.city, f.district);
  const [data, setData] = useState<{ total: number; items: RequestItem[] } | null>(null);
  const [openFilters, setOpenFilters] = useState(false);
  const [others, setOthers] = useState<RequestItem[] | null>(null);
  // Kategori veya adres çubuğundaki arama değişince filtreler sıfırlanır; ilk açılışta (zaten başlangıç değerleri) sıfırlanmaz,
  // yoksa kullanıcının sayfa açılırken seçtiği il kaybolur.
  const navKey = `${top}|${sub}|${sp.toString()}`;
  const lastKey = useRef(navKey);
  useEffect(() => { if (lastKey.current !== navKey) { lastKey.current = navKey; setF(initial()); } }, [navKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (top) p.set("top", top);
    if (sub) p.set("sub", sub);
    if (f.q.trim()) p.set("q", f.q.trim());
    if (f.city) p.set("city", f.city);
    if (f.city && f.district) p.set("district", f.district);
    if (f.city && f.district && f.hood) p.set("neighbourhood", f.hood);
    if (f.bmin) p.set("bmin", f.bmin);
    if (f.bmax) p.set("bmax", f.bmax);
    if (f.cond.length) p.set("cond", f.cond.join(","));
    for (const [k, v] of Object.entries(f.attrs)) if (v.length) p.set(`a_${k}`, v.join(","));
    if (f.urgent) p.set("urgent", "1");
    if (f.noOffers) p.set("no_offers", "1");
    if (f.buyer) p.set("buyer", f.buyer);
    const v = f.veh;
    if (v.marka) p.set("arac_marka", v.marka);
    if (v.marka && v.model) p.set("arac_model", v.model);
    if (v.yil) p.set("arac_yil", v.yil);
    if (v.km) p.set("arac_km", v.km);
    if (v.yakit) p.set("arac_yakit", v.yakit);
    if (v.vites) p.set("arac_vites", v.vites);
    p.set("sort", f.sort);
    p.set("page", String(f.page));
    p.set("per", String(PER));
    return p.toString();
  }, [top, sub, f]);

  useEffect(() => {
    const h = setTimeout(() => { void api<{ total: number; items: RequestItem[] }>(`/requests?${qs}`).then(setData).catch(() => setData({ total: 0, items: [] })); }, 250);
    return () => clearTimeout(h);
  }, [qs]);

  // Sonuç yoksa "boş" demek yerine diğer güncel talepler gösterilir.
  useEffect(() => {
    if (data?.total !== 0 || others) return;
    void api<{ items: RequestItem[] }>("/requests?per=10").then((r) => setOthers(r.items)).catch(() => setOthers([]));
  }, [data, others]);

  const set = (patch: Partial<F>) => setF((x) => ({ ...x, page: 1, ...patch }));
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const title = s ? `${s.name} Alım Talepleri` : t ? `${t.name} Alım Talepleri` : f.q ? `"${f.q}" için talepler` : "Tüm Alım Talepleri";
  const pages = data ? Math.max(1, Math.ceil(data.total / PER)) : 1;
  const go = (n: number) => { setF((x) => ({ ...x, page: n })); window.scrollTo(0, 0); };
  const selAttrs = t ? attrsFor(t.id, s?.id).filter((a) => a.t === "sel") : [];
  const cat = useVehicleCatalog();
  const vehBrands = cat ? (sub === "motosiklet" ? cat.moto : cat.cars) : {};
  const setVeh = (p: Partial<Veh>) => set({ veh: { ...f.veh, ...p } });


  if (top && categories.length && !t) return <div className="wrap"><div className="crumb"><Link href="/">Ana Sayfa</Link></div><div className="box"><div className="empty">Bu kategori şu anda yayında değil.</div></div></div>;

  // Seçili filtreler üstte tek tek kaldırılabilen etiketler olarak görünür.
  const chips: { k: string; l: string; clear: () => void }[] = [];
  if (f.q.trim()) chips.push({ k: "q", l: `"${f.q.trim()}"`, clear: () => set({ q: "" }) });
  if (f.city) chips.push({ k: "city", l: [f.city, f.district, f.hood].filter(Boolean).join(" / "), clear: () => set({ city: "", district: "", hood: "" }) });
  if (f.bmin || f.bmax) chips.push({ k: "b", l: `${f.bmin ? fmt(Number(f.bmin)) : "0"} – ${f.bmax ? fmt(Number(f.bmax)) : "∞"} TL`, clear: () => set({ bmin: "", bmax: "" }) });
  for (const c of f.cond) chips.push({ k: `c-${c}`, l: c, clear: () => set({ cond: f.cond.filter((x) => x !== c) }) });
  for (const [k, vs] of Object.entries(f.attrs)) for (const v of vs) chips.push({ k: `a-${k}-${v}`, l: v, clear: () => set({ attrs: { ...f.attrs, [k]: (f.attrs[k] ?? []).filter((x) => x !== v) } }) });
  if (f.veh.marka) chips.push({ k: "veh", l: [f.veh.marka, f.veh.model, f.veh.yil].filter(Boolean).join(" "), clear: () => set({ veh: NO_VEH }) });
  if (f.urgent) chips.push({ k: "u", l: "Acil", clear: () => set({ urgent: false }) });
  if (f.buyer) chips.push({ k: "buyer", l: f.buyer === "kurumsal" ? "Kurumsal alıcılar" : "Bireysel alıcılar", clear: () => set({ buyer: "" }) });

  return (
    <div className="wrap">
      <div className="crumb"><Link href="/">Ana Sayfa</Link> › <Link href="/kategori">Talepler</Link>{t && <> › <Link href={`/kategori/${t.id}`}>{t.name}</Link></>}{s && <> › {s.name}</>}</div>
      <div className="list-head"><h1>{title}</h1><button className="btn btn-wh btn-sm flt-toggle" onClick={() => setOpenFilters((o) => !o)}>Filtrele{chips.length > 0 && <span className="badge">{chips.length}</span>}</button></div>
      <div className="listing">
        <aside className={"flt" + (openFilters ? " open" : "")}>
          <div className="flt-sec flt-cats">
            <h4>Kategori</h4>
            {t ? (
              <>
                <Link href="/kategori">« Tüm kategoriler</Link>
                <Link href={`/kategori/${t.id}`} className={!sub ? "on" : ""}><span>{t.name}</span><span className="n">{count(t.active_count)}</span></Link>
                {t.subs.filter((x) => x.id === sub || browseCategories.some((b) => b.subs.some((y) => y.id === x.id))).map((x) => <Link key={x.id} href={`/kategori/${t.id}/${x.id}`} className={sub === x.id ? "on" : ""} style={{ paddingLeft: 10 }}><span>{x.name}</span><span className="n">{count(x.active_count)}</span></Link>)}
              </>
            ) : browseCategories.map((x) => <Link key={x.id} href={`/kategori/${x.id}`}><span>{x.name}</span><span className="n">{count(x.active_count)}</span></Link>)}
          </div>
          {top === "vasita" && cat && (
            <div className="flt-sec veh-flt">
              <h4>Elimdeki araç</h4>
              <p className="hint" style={{ marginTop: 0 }}>Satacağınız aracı girin, ona uyan talepleri görün.</p>
              <select className="sel" aria-label="Aracın markası" value={f.veh.marka} onChange={(e) => setVeh({ marka: e.target.value, model: "" })}><option value="">Marka</option>{Object.keys(vehBrands).map((b) => <option key={b}>{b}</option>)}</select>
              <select className="sel" aria-label="Aracın modeli" value={f.veh.model} disabled={!f.veh.marka} onChange={(e) => setVeh({ model: e.target.value })}><option value="">Model</option>{(vehBrands[f.veh.marka] ?? []).map((m) => <option key={m}>{m}</option>)}</select>
              <div className="mm"><input className="inp" type="number" placeholder="Yılı" aria-label="Aracın yılı" value={f.veh.yil} onChange={(e) => setVeh({ yil: e.target.value })} /><input className="inp" type="number" placeholder="Km" aria-label="Aracın kilometresi" value={f.veh.km} onChange={(e) => setVeh({ km: e.target.value })} /></div>
              <div className="mm"><select className="sel" aria-label="Aracın yakıtı" value={f.veh.yakit} onChange={(e) => setVeh({ yakit: e.target.value })}><option value="">Yakıt</option>{cat.fuels.map((x) => <option key={x}>{x}</option>)}</select><select className="sel" aria-label="Aracın vitesi" value={f.veh.vites} onChange={(e) => setVeh({ vites: e.target.value })}><option value="">Vites</option>{cat.gears.map((x) => <option key={x}>{x}</option>)}</select></div>
            </div>
          )}
          <div className="flt-sec"><h4>Kelime</h4><input className="inp" value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="Talepte ara" /></div>
          <div className="flt-sec flt-adr"><h4>Adres</h4>
            <select className="sel" value={f.city} onChange={(e) => set({ city: e.target.value, district: "", hood: "" })} aria-label="İl"><option value="">Tüm iller</option>{CITIES.map((c) => <option key={c}>{c}</option>)}</select>
            {f.city && <select className="sel" value={f.district} onChange={(e) => set({ district: e.target.value, hood: "" })} aria-label="İlçe"><option value="">Tüm ilçeler</option>{districts.map((c) => <option key={c}>{c}</option>)}</select>}
            {f.district && <select className="sel" value={f.hood} onChange={(e) => set({ hood: e.target.value })} aria-label="Mahalle"><option value="">Tüm mahalleler</option>{hoods.map((c) => <option key={c}>{c}</option>)}</select>}
            {f.district && <span className="hint">İlçe veya mahalle "farketmez" diyen alıcılar da listelenir.</span>}
          </div>
          <div className="flt-sec"><h4>Alıcının bütçesi (TL)</h4><div className="mm"><input className="inp" type="number" placeholder="en az" value={f.bmin} onChange={(e) => set({ bmin: e.target.value })} aria-label="Bütçe en az" /><input className="inp" type="number" placeholder="en çok" value={f.bmax} onChange={(e) => set({ bmax: e.target.value })} aria-label="Bütçe en çok" /></div></div>
          {condsFor(top).length > 1 && <div className="flt-sec"><h4>Ürün durumu</h4>{condsFor(top).map((c) => <label className="chk" key={c}><input type="checkbox" checked={f.cond.includes(c)} onChange={() => set({ cond: toggle(f.cond, c) })} />{c}</label>)}</div>}
          {selAttrs.map((a) => (
            <div className="flt-sec" key={a.k}><h4>{a.l}</h4>
              {a.o!.map((o) => <label className="chk" key={o}><input type="checkbox" checked={(f.attrs[a.k] ?? []).includes(o)} onChange={() => set({ attrs: { ...f.attrs, [a.k]: toggle(f.attrs[a.k] ?? [], o) } })} />{o}</label>)}
            </div>
          ))}
          <div className="flt-sec">
            <label className="chk"><input type="checkbox" checked={f.urgent} onChange={(e) => set({ urgent: e.target.checked })} />Sadece acil talepler</label>
            <label className="chk"><input type="checkbox" checked={f.buyer === "kurumsal"} onChange={(e) => set({ buyer: e.target.checked ? "kurumsal" : "" })} />Sadece kurumsal alıcılar (firma, faturalı alım)</label>
            <button className="btn btn-wh btn-sm" style={{ marginTop: 8 }} onClick={() => setF({ ...initial(), q: "", urgent: false, noOffers: false, buyer: "" })}>Filtreleri temizle</button>
          </div>
        </aside>
        <div>
          <div className="res-bar">
            <div className="res-sum">
              <div className="res-cnt">{!data ? "Yükleniyor…" : data.total > 0 ? (count(data.total) !== null ? <><b>{data.total}</b> alıcı talebi</> : <>Alıcı talepleri</>) : <>Uygun talep yok</>}</div>
              {chips.length > 0 && (
                <div className="res-chips">
                  {chips.map((c) => <button key={c.k} className="fchip" onClick={c.clear} aria-label={`${c.l} filtresini kaldır`}>{c.l}<span aria-hidden="true">×</span></button>)}
                  <button className="link" style={{ fontSize: 12 }} onClick={() => setF({ ...initial(), q: "", urgent: false, noOffers: false, buyer: "" })}>Temizle</button>
                </div>
              )}
            </div>
            <div className="res-tools">
              
              <select className="sel" value={f.sort} onChange={(e) => set({ sort: e.target.value })} aria-label="Sıralama">
                <option value="new">En yeni</option><option value="old">En eski</option>
                <option value="budget_desc">Bütçe: yüksekten düşüğe</option><option value="budget_asc">Bütçe: düşükten yükseğe</option>
                <option value="ending">Süresi yakında bitecek</option>
              </select>
            </div>
          </div>
          <div className="tbl-wrap">
            {!data ? <div className="loading">Yükleniyor…</div> : data.total > 0 ? <RequestTable items={data.items} /> : (
              <div className="soon">
                <h2>{s?.name ?? t?.name ?? "Bu arama"} için talepler yakında burada</h2>
                <div className="soon-grid">
                  <div><b>Satıcı mısınız?</b><p>Bu bölüme ilk alım talebi geldiği anda size SMS ile haber verelim; ilk ulaşan siz olun.</p><Link className="btn btn-or" href="/bana-ozel?s=alarm">Talep gelince haber ver</Link></div>
                  <div><b>Bunu mu almak istiyorsunuz?</b><p>Talebinizi ücretsiz verin; satıcılar sizi arasın veya mesaj atsın.</p><Link className="btn btn-bl" href={`/talep-ver${f.q ? `?metin=${encodeURIComponent(f.q)}` : ""}`}>Ücretsiz talep ver</Link></div>
                </div>
              </div>
            )}
          </div>
          {data?.total === 0 && !!others?.length && <div className="box" style={{ marginTop: 14 }}><div className="box-h"><h2>Diğer güncel talepler</h2><Link className="link" href="/kategori">Tümü »</Link></div><RequestTable items={others} /></div>}
          {pages > 1 && <nav className="pager" aria-label="Sayfalar">
            {f.page > 1 && <button aria-label="Önceki sayfa" onClick={() => go(f.page - 1)}>‹</button>}
            {pageList(f.page, pages).map((n, i) => n === 0 ? <span key={`e${i}`} className="pg-gap">…</span>
              : <button key={n} className={f.page === n ? "on" : ""} aria-current={f.page === n ? "page" : undefined} onClick={() => go(n)}>{n}</button>)}
            {f.page < pages && <button aria-label="Sonraki sayfa" onClick={() => go(f.page + 1)}>›</button>}
          </nav>}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="loading">Yükleniyor…</div>}><Listing /></Suspense>;
}
