"use client";

import { useEffect, useState } from "react";
import { brandsOf, useVehicleCatalog, variantsOf, vehicleName, vehicleNames, yearTxt, type VehicleAttrs } from "@/lib/vehicles";

const YEARS = Array.from({ length: new Date().getFullYear() + 2 - 1990 }, (_, i) => new Date().getFullYear() + 1 - i);

// Alıcının araç talebi: birden fazla marka/model eklenebilir, diğer alanlar birden fazla seçimli.
// onDraft: listede seçili ama henüz "Ekle"ye basılmamış marka/model (hazır görseller buna göre değişsin diye).
export function VehicleFields({ sub, value, onChange, onDraft }: { sub: string; value: VehicleAttrs; onChange: (v: VehicleAttrs) => void; onDraft?: (d: { marka: string; model: string | null; paket?: string | null } | null) => void }) {
  const cat = useVehicleCatalog();
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [paket, setPaket] = useState("");
  useEffect(() => { onDraft?.(brand ? { marka: brand, model: model || null, paket: (model && paket) || null } : null); }, [brand, model, paket]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!cat) return <div className="fg full"><span className="muted">Araç listesi yükleniyor…</span></div>;
  const brands = brandsOf(cat, sub);
  const list = value.araclar ?? [];
  const set = (p: Partial<VehicleAttrs>) => {
    const next = { ...value, ...p };
    for (const k of Object.keys(next) as (keyof VehicleAttrs)[]) {
      const v = next[k];
      if (v === undefined || v === null || (Array.isArray(v) && !v.length) || v === false) delete next[k];
    }
    onChange(next);
  };
  const add = () => {
    if (!brand || list.length >= cat.max) return;
    const m = model || null, pk = (m && paket) || null;
    // Daha geniş bir seçim zaten varsa eklenmez; daha genişi eklenince kapsadığı seçimler çıkar (marka ⊃ model ⊃ paket).
    if (list.some((x) => x.marka === brand && (x.model === null || (x.model === m && (!x.paket || x.paket === pk))))) return;
    const rest = list.filter((x) => !(x.marka === brand && (!m || (x.model === m && !pk))));
    set({ araclar: [...rest, { marka: brand, model: m, ...(pk ? { paket: pk } : {}) }] });
    setModel(""); setPaket("");
  };
  const toggle = (k: "yakit" | "vites" | "kasa", v: string) => {
    const cur = value[k] ?? [];
    set({ [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
  };
  const num = (s: string) => (s === "" ? undefined : Number(s));

  return (
    <>
      <div className="fg full">
        <label>İstediğiniz araçlar <span className="muted">(en fazla {cat.max}; boş bırakırsanız marka farketmez)</span></label>
        {!!list.length && (
          <div className="chips">{list.map((x, i) => (
            <span key={`${x.marka}-${x.model}-${x.paket ?? ""}`} className="chip on">{vehicleName(x)}
              <button type="button" aria-label={`${vehicleName(x)} kaldır`} onClick={() => set({ araclar: list.filter((_, k) => k !== i) })}>×</button></span>
          ))}</div>
        )}
        {list.length < cat.max && (
          <div className="veh-add">
            <select className="sel" aria-label="Marka" value={brand} onChange={(e) => { setBrand(e.target.value); setModel(""); setPaket(""); }}>
              <option value="">Marka seçin</option>{Object.keys(brands).map((b) => <option key={b}>{b}</option>)}
            </select>
            <select className="sel" aria-label="Model" value={model} onChange={(e) => { setModel(e.target.value); setPaket(""); }} disabled={!brand}>
              <option value="">{brand === "Diğer" ? "Markayı açıklamaya yazın" : "Tüm modeller"}</option>{(brands[brand] ?? []).map((m) => <option key={m}>{m}</option>)}
            </select>
            {variantsOf(cat, sub, brand, model).length > 0 && (
              <select className="sel" aria-label="Motor / paket" value={paket} onChange={(e) => setPaket(e.target.value)}>
                <option value="">Tüm paketler</option>{variantsOf(cat, sub, brand, model).map((v) => <option key={v}>{v}</option>)}
              </select>
            )}
            <button type="button" className="btn btn-bl" disabled={!brand} onClick={add}>+ Ekle</button>
          </div>
        )}
        {brand && <div className="sel-path" aria-label="Seçiminiz">Seçiminiz: <b>{[brand, model || "Tüm modeller", model && variantsOf(cat, sub, brand, model).length ? paket || "Tüm paketler" : ""].filter(Boolean).join(" › ")}</b></div>}
        <span className="hint">Birden fazla seçenekle daha çok satıcıya ulaşırsınız. Örn. BMW 3 Serisi 320d, Audi A4, Mercedes-Benz C Serisi. Motor/paket seçmezseniz modelin bütün paketleri sayılır.</span>
      </div>
      <div className="fg"><label htmlFor="v-ymin">Model yılı (en eski)</label>
        <select className="sel" id="v-ymin" value={value.yil_min ?? ""} onChange={(e) => set({ yil_min: num(e.target.value) })}><option value="">Farketmez</option>{YEARS.map((y) => <option key={y}>{y}</option>)}</select></div>
      <div className="fg"><label htmlFor="v-ymax">Model yılı (en yeni)</label>
        <select className="sel" id="v-ymax" value={value.yil_max ?? ""} onChange={(e) => set({ yil_max: num(e.target.value) })}><option value="">Farketmez</option>{YEARS.map((y) => <option key={y}>{y}</option>)}</select></div>
      <div className="fg"><label htmlFor="v-km">En fazla kilometre</label>
        <input className="inp" id="v-km" type="number" inputMode="numeric" placeholder="Farketmez" value={value.km_max ?? ""} onChange={(e) => set({ km_max: num(e.target.value) })} /></div>
      <div className="fg"><label>&nbsp;</label><label className="chk" style={{ height: 34 }}><input type="checkbox" checked={!!value.hasarsiz} onChange={(e) => set({ hasarsiz: e.target.checked })} />Hasarsız / boyasız olsun</label></div>
      {([["yakit", "Yakıt", cat.fuels], ["vites", "Vites", cat.gears], ["kasa", "Kasa tipi", cat.bodies]] as const).map(([k, l, opts]) => (
        <div className="fg full" key={k}><label>{l} <span className="muted">(birden fazla seçilebilir; seçmezseniz farketmez)</span></label>
          <div className="chips">{opts.map((o) => <button type="button" key={o} className={"chip" + ((value[k] ?? []).includes(o) ? " on" : "")} aria-pressed={(value[k] ?? []).includes(o)} onClick={() => toggle(k, o)}>{o}</button>)}</div>
        </div>
      ))}
    </>
  );
}

// Talep sayfası ve önizleme için satırlar.
export function VehicleRows({ a }: { a: VehicleAttrs }) {
  const rows: [string, string][] = [
    ["Araç", vehicleNames(a).join(", ")],
    ["Model yılı", yearTxt(a)],
    ["Kilometre", a.km_max !== undefined ? `en fazla ${a.km_max.toLocaleString("tr-TR")} km` : ""],
    ["Yakıt", (a.yakit ?? []).join(", ")], ["Vites", (a.vites ?? []).join(", ")], ["Kasa tipi", (a.kasa ?? []).join(", ")],
    ["Hasar", a.hasarsiz ? "Hasarsız / boyasız olsun" : ""],
  ];
  return <>{rows.filter(([, v]) => v).map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</>;
}

