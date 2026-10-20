"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { attrsFor, CITIES, condsFor, NUM_SHORT, sellerNum } from "@/lib/catalog";
import { useDistricts, useNeighbourhoods } from "@/lib/locations";
import { brandsOf, isVehicleSub, useVehicleCatalog } from "@/lib/vehicles";
import { fmt } from "@/lib/format";
import { useSession } from "./Session";

// Alarm = kaydedilmiş arama. Alanlar talep listesindeki süzgeçlerle aynı adları taşır.
export type AlarmFilters = Record<string, string>;
export type Alarm = { id: number; category_id: string; category_name: string; top_name: string | null; filters: AlarmFilters; created_at: string };

const LABELS: Record<string, string> = { q: "Kelime", cond: "Durum", arac_yakit: "Yakıt", arac_vites: "Vites", arac_kasa: "Kasa" };

// Alarmın okunur özeti: "İzmir / Urla · 1.000.000 – 5.000.000 TL · İmar: Konut · "deniz" geçen".
export function alarmSummary(a: Pick<Alarm, "category_id" | "filters">, top?: string): string[] {
  const f = a.filters ?? {};
  const out: string[] = [];
  out.push([f.city ? f.city.split(",").join(", ") : "Tüm iller", f.district, f.neighbourhood].filter(Boolean).join(" / "));
  if (f.bmin || f.bmax) out.push(f.bmin && f.bmax ? `${fmt(Number(f.bmin))} – ${fmt(Number(f.bmax))} TL` : f.bmin ? `${fmt(Number(f.bmin))} TL ve üstü` : `en fazla ${fmt(Number(f.bmax))} TL`);
  if (f.arac_marka) out.push([f.arac_marka, f.arac_model].filter(Boolean).join(" "));
  if (f.araclar) out.push(parseCars(f.araclar).map(carName).join(", "));
  if (f.arac_yil) out.push(`${f.arac_yil} model`);
  if (f.arac_km) out.push(`${fmt(Number(f.arac_km))} km`);
  for (const at of attrsFor(top, a.category_id)) if (f[`a_${at.k}`]) out.push(`${at.l}: ${f[`a_${at.k}`]!.split(",").join(", ")}`);
  for (const [k, v] of Object.entries(f)) if (k.startsWith("n_") && NUM_SHORT[k.slice(2)]) out.push(`${NUM_SHORT[k.slice(2)]}: ${k === "n_m2" ? fmt(Number(v)) : v}`);
  for (const k of ["cond", "arac_yakit", "arac_vites", "arac_kasa"]) if (f[k]) out.push(`${LABELS[k]}: ${f[k]!.split(",").join(", ")}`);
  if (f.q) out.push(`"${f.q}" geçen`);
  if (f.urgent) out.push("Yalnızca acil");
  if (f.buyer === "kurumsal") out.push("Yalnızca kurumsal alıcı");
  return out;
}

// Alarmdaki araç listesi "BMW:3 Serisi,Audi:" biçiminde saklanır (model boşsa markanın bütün modelleri).
type Car = { marka: string; model: string };
export const parseCars = (s: string): Car[] => s.split(",").filter(Boolean).map((x) => { const [marka = "", model = ""] = x.split(":"); return { marka, model }; });
const carsTxt = (cars: Car[]) => cars.map((c) => `${c.marka}:${c.model}`).join(",");
const carName = (c: Car) => (c.model ? `${c.marka} ${c.model}` : `${c.marka} (tüm modeller)`);

// Çoklu seçim düğmeleri; hiçbiri seçili değilse "Farketmez" seçili görünür, ona basınca seçimler temizlenir.
function Chips({ options, value, onChange, label }: { options: readonly string[]; value: string; onChange: (v: string) => void; label: string }) {
  const cur = value.split(",").filter(Boolean);
  const flip = (o: string) => onChange((cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o]).join(","));
  return (
    <div className="chips" role="group" aria-label={label}>
      <button type="button" className={"chip" + (!cur.length ? " on" : "")} aria-pressed={!cur.length} onClick={() => onChange("")}>Farketmez</button>
      {options.filter((o) => o !== "Farketmez").map((o) => (
        <button key={o} type="button" className={"chip" + (cur.includes(o) ? " on" : "")} aria-pressed={cur.includes(o)} onClick={() => flip(o)}>{o}</button>
      ))}
    </div>
  );
}

// Ayrıntılı alarm kurma formu: kategori seçilince o kategoriye özel seçenekler açılır.
export function AlarmForm({ onSaved }: { onSaved: () => void }) {
  const { categories, toast } = useSession();
  const cat = useVehicleCatalog();
  const [catId, setCatId] = useState("");
  const [f, setF] = useState<AlarmFilters>({});
  const [busy, setBusy] = useState(false);
  // Birden fazla il seçilebilir; tek il seçiliyken ilçe/mahalle sorulur.
  const cities = (f.city ?? "").split(",").filter(Boolean);
  const oneCity = cities.length === 1 ? cities[0]! : "";
  const districts = useDistricts(oneCity);
  const hoods = useNeighbourhoods(oneCity, f.district ?? "");
  // Araç listesi: marka + model seçip "Ekle"; listede istediği kadar araç olabilir.
  const [mk, setMk] = useState(""), [md, setMd] = useState("");
  const cars = parseCars(f.araclar ?? "");
  const top = categories.find((t) => t.id === catId || t.subs.some((s) => s.id === catId));
  const sub = top?.subs.find((s) => s.id === catId);
  // Vasıtada alt kategori seçilmese de marka/model sorulur (otomobil, SUV, ticari… hepsinde aranır).
  const vehicle = top?.id === "vasita" ? !sub || isVehicleSub(sub.id) : isVehicleSub(sub?.id);
  const attrs = vehicle ? [] : attrsFor(top?.id, sub?.id).filter((a) => a.t === "sel");
  // Sayı alanları satıcıya kendi ürünü üzerinden sorulur ("Arsanızın m²'si" gibi).
  const nums = vehicle ? [] : attrsFor(top?.id, sub?.id).filter((a) => a.t === "num" && sellerNum(a.k, sub?.id));
  const conds = condsFor(top?.id).filter((c) => c !== "Farketmez");
  const brands = cat && vehicle ? (sub ? brandsOf(cat, sub.id) : cat.cars) : {};
  const set = (p: AlarmFilters) => setF((x) => { const n = { ...x, ...p }; for (const k of Object.keys(n)) if (!n[k]) delete n[k]; return n; });

  // Kategori değişince yalnızca yer, bütçe ve kelime korunur; kategoriye özel seçimler sıfırlanır.
  const pick = (id: string) => {
    setCatId(id);
    setF((x) => Object.fromEntries(Object.entries(x).filter(([k]) => ["city", "district", "neighbourhood", "bmin", "bmax", "q"].includes(k))));
  };
  const addCar = () => {
    if (!mk) return;
    const next = cars.filter((c) => !(c.marka === mk && (c.model === md || !md)) && !(c.marka === mk && !c.model && md));
    set({ araclar: carsTxt([...next, { marka: mk, model: md }]) });
    setMd("");
  };
  const addCity = (c: string) => { if (c && !cities.includes(c)) set({ city: [...cities, c].join(","), district: "", neighbourhood: "" }); };
  const save = async () => {
    if (!catId) return toast("Ana kategori seçin.");
    // Listeye eklenmeden bırakılan marka/model de alarma girsin.
    const body = { ...f };
    if (mk && !cars.some((c) => c.marka === mk && c.model === md)) body.araclar = carsTxt([...cars, { marka: mk, model: md }]);
    setBusy(true);
    try {
      await api("/me/alarms", { body: { category_id: catId, filters: body } });
      toast("Alarm kuruldu. Uygun yeni talep gelince haber vereceğiz.");
      setCatId(""); setF({}); setMk(""); setMd(""); onSaved();
    } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="box"><div className="box-h"><h3>Yeni alarm</h3></div><div className="box-b">
      <div className="form-grid">
        <div className="fg"><label htmlFor="al-top">Ana kategori *</label>
          <select className="sel" id="al-top" value={top?.id ?? ""} onChange={(e) => pick(e.target.value)}>
            <option value="">Seçin</option>{categories.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select></div>
        <div className="fg"><label htmlFor="al-sub">Alt kategori</label>
          <select className="sel" id="al-sub" value={sub?.id ?? ""} disabled={!top} onChange={(e) => pick(e.target.value || top!.id)}>
            <option value="">{top ? `Tüm ${top.name}` : "Önce ana kategori"}</option>{top?.subs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select></div>
        <div className="fg"><label htmlFor="al-c">İller <span className="muted">(birden fazla seçilebilir)</span></label>
          <select className="sel" id="al-c" value="" onChange={(e) => addCity(e.target.value)}><option value="">{cities.length ? "Başka il ekle" : "Tüm iller (farketmez)"}</option>{CITIES.filter((c) => !cities.includes(c)).map((c) => <option key={c}>{c}</option>)}</select>
          <div className="chips" style={{ marginTop: 6 }}>
            {cities.length ? cities.map((c) => <button key={c} type="button" className="chip on" aria-label={`${c} ilini çıkar`} onClick={() => set({ city: cities.filter((x) => x !== c).join(","), district: "", neighbourhood: "" })}>{c} ✕</button>)
              : <span className="chip on">Tüm iller</span>}
            {cities.length > 0 && <button type="button" className="chip" onClick={() => set({ city: "", district: "", neighbourhood: "" })}>Farketmez (tüm iller)</button>}
          </div></div>
        <div className="fg"><label htmlFor="al-d">İlçe</label><select className="sel" id="al-d" value={f.district ?? ""} disabled={!oneCity} onChange={(e) => set({ district: e.target.value, neighbourhood: "" })}><option value="">{oneCity ? "Tüm ilçeler (farketmez)" : cities.length > 1 ? "Birden fazla il seçildi: tüm ilçeler" : "Önce il seçin"}</option>{districts.map((x) => <option key={x}>{x}</option>)}</select></div>
        {f.district && <div className="fg"><label htmlFor="al-m">Mahalle</label><select className="sel" id="al-m" value={f.neighbourhood ?? ""} onChange={(e) => set({ neighbourhood: e.target.value })}><option value="">Tüm mahalleler (farketmez)</option>{hoods.map((x) => <option key={x}>{x}</option>)}</select></div>}
        <div className="fg"><label htmlFor="al-bmin">Alıcı bütçesi en az (TL)</label><input className="inp" id="al-bmin" type="number" inputMode="numeric" value={f.bmin ?? ""} onChange={(e) => set({ bmin: e.target.value })} /></div>
        <div className="fg"><label htmlFor="al-bmax">Alıcı bütçesi en fazla (TL)</label><input className="inp" id="al-bmax" type="number" inputMode="numeric" value={f.bmax ?? ""} onChange={(e) => set({ bmax: e.target.value })} /></div>
        <div className="fg full"><label htmlFor="al-q">Kelime (isteğe bağlı)</label><input className="inp" id="al-q" maxLength={60} value={f.q ?? ""} onChange={(e) => set({ q: e.target.value })} placeholder="Örn. deniz manzaralı, iPhone 15, 4x4" /><span className="hint">Talebin başlığında ya da açıklamasında bu kelime geçenler.</span></div>
        {vehicle && cat && (
          <>
            <div className="fg full al-cars"><label>Elinizdeki araçlar <span className="muted">(istediğiniz kadar ekleyin; birine uyan talep gelince haber veririz)</span></label>
              <div className="al-car-add">
                <select className="sel" aria-label="Marka" value={mk} onChange={(e) => { setMk(e.target.value); setMd(""); }}><option value="">Marka seçin</option>{Object.keys(brands).map((b) => <option key={b}>{b}</option>)}</select>
                <select className="sel" aria-label="Model" value={md} disabled={!mk} onChange={(e) => setMd(e.target.value)}><option value="">Tüm modeller</option>{(brands[mk] ?? []).map((m) => <option key={m}>{m}</option>)}</select>
                <button type="button" className="btn btn-wh" disabled={!mk} onClick={addCar}>+ Ekle</button>
              </div>
              <div className="chips" style={{ marginTop: 6 }}>
                {cars.length ? cars.map((c) => <button key={c.marka + c.model} type="button" className="chip on" aria-label={`${carName(c)} aracını çıkar`} onClick={() => set({ araclar: carsTxt(cars.filter((x) => x !== c)) })}>{carName(c)} ✕</button>)
                  : <span className="chip on">Tüm markalar (farketmez)</span>}
                {cars.length > 0 && <button type="button" className="chip" onClick={() => set({ araclar: "" })}>Hepsini temizle</button>}
              </div></div>
            <div className="fg"><label htmlFor="al-y">Satacağınız aracın model yılı</label><input className="inp" id="al-y" type="number" inputMode="numeric" value={f.arac_yil ?? ""} onChange={(e) => set({ arac_yil: e.target.value })} placeholder="Örn. 2019" /><span className="hint">2019 yazarsanız "2018 ve sonrası" isteyenler gelir, "2021 ve sonrası" isteyenler gelmez.</span></div>
            <div className="fg"><label htmlFor="al-km">Satacağınız aracın kilometresi</label><input className="inp" id="al-km" type="number" inputMode="numeric" value={f.arac_km ?? ""} onChange={(e) => set({ arac_km: e.target.value })} placeholder="Örn. 85000" /><span className="hint">85.000 yazarsanız "en fazla 100.000 km" isteyenler gelir, "en fazla 50.000 km" isteyenler gelmez.</span></div>
            <div className="fg full"><label>Yakıt <span className="muted">(birden fazla seçilebilir)</span></label><Chips label="Yakıt" options={cat.fuels} value={f.arac_yakit ?? ""} onChange={(v) => set({ arac_yakit: v })} /></div>
            <div className="fg full"><label>Vites</label><Chips label="Vites" options={cat.gears} value={f.arac_vites ?? ""} onChange={(v) => set({ arac_vites: v })} /></div>
            <div className="fg full"><label>Kasa tipi</label><Chips label="Kasa tipi" options={cat.bodies} value={f.arac_kasa ?? ""} onChange={(v) => set({ arac_kasa: v })} /></div>
          </>
        )}
        {nums.map((a) => { const sn = sellerNum(a.k, sub?.id)!; return (
          <div className="fg" key={a.k}><label htmlFor={`al-n-${a.k}`}>{sn.l}</label>
            <input className="inp" id={`al-n-${a.k}`} type="number" inputMode="decimal" min={0} value={f[`n_${a.k}`] ?? ""} onChange={(e) => set({ [`n_${a.k}`]: e.target.value })} />
            <span className="hint">{sn.h}</span></div>
        ); })}
        {attrs.map((a) => (
          <div className="fg full" key={a.k}><label>{a.l} <span className="muted">(birden fazla seçilebilir)</span></label>
            <Chips label={a.l} options={a.o!} value={f[`a_${a.k}`] ?? ""} onChange={(v) => set({ [`a_${a.k}`]: v })} /></div>
        ))}
        {catId && conds.length > 1 && (
          <div className="fg full"><label>Ürün durumu</label><Chips label="Ürün durumu" options={conds} value={f.cond ?? ""} onChange={(v) => set({ cond: v })} /></div>
        )}
        <div className="fg full"><label>Seçenekler</label>
          <label className="chk"><input type="checkbox" checked={!!f.urgent} onChange={(e) => set({ urgent: e.target.checked ? "1" : "" })} />Yalnızca acil talepler</label>
          <label className="chk"><input type="checkbox" checked={f.buyer === "kurumsal"} onChange={(e) => set({ buyer: e.target.checked ? "kurumsal" : "" })} />Yalnızca kurumsal (faturalı) alıcılar</label>
        </div>
      </div>
      <button className="btn btn-bl" style={{ marginTop: 12 }} disabled={busy} onClick={() => void save()}>{busy ? "Kaydediliyor…" : "Alarm kur"}</button>
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Alarm satıcılar içindir: elinizdeki ürünü almak isteyen bir alıcı talep verince haber verir. Seçtiklerinize uyan yeni talep gelince sitedeki zil simgesinden ve (bağlıysa) SMS/e-posta ile haber veririz. Boş bıraktığınız alanlar "farketmez" sayılır.</p>
    </div></div>
  );
}
