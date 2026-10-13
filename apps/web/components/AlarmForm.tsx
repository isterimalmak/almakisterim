"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { attrsFor, CITIES, condsFor } from "@/lib/catalog";
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
  out.push([f.city || "Tüm iller", f.district, f.neighbourhood].filter(Boolean).join(" / "));
  if (f.bmin || f.bmax) out.push(f.bmin && f.bmax ? `${fmt(Number(f.bmin))} – ${fmt(Number(f.bmax))} TL` : f.bmin ? `${fmt(Number(f.bmin))} TL ve üstü` : `en fazla ${fmt(Number(f.bmax))} TL`);
  if (f.arac_marka) out.push([f.arac_marka, f.arac_model].filter(Boolean).join(" "));
  if (f.arac_yil) out.push(`${f.arac_yil} model`);
  if (f.arac_km) out.push(`${fmt(Number(f.arac_km))} km`);
  for (const at of attrsFor(top, a.category_id)) if (f[`a_${at.k}`]) out.push(`${at.l}: ${f[`a_${at.k}`]!.split(",").join(", ")}`);
  for (const k of ["cond", "arac_yakit", "arac_vites", "arac_kasa"]) if (f[k]) out.push(`${LABELS[k]}: ${f[k]}`);
  if (f.q) out.push(`"${f.q}" geçen`);
  if (f.urgent) out.push("Yalnızca acil");
  if (f.buyer === "kurumsal") out.push("Yalnızca kurumsal alıcı");
  return out;
}

// Ayrıntılı alarm kurma formu: kategori seçilince o kategoriye özel seçenekler açılır.
export function AlarmForm({ onSaved }: { onSaved: () => void }) {
  const { categories, toast } = useSession();
  const cat = useVehicleCatalog();
  const [catId, setCatId] = useState("");
  const [f, setF] = useState<AlarmFilters>({});
  const [busy, setBusy] = useState(false);
  const districts = useDistricts(f.city ?? "");
  const hoods = useNeighbourhoods(f.city ?? "", f.district ?? "");
  const top = categories.find((t) => t.id === catId || t.subs.some((s) => s.id === catId));
  const sub = top?.subs.find((s) => s.id === catId);
  const vehicle = isVehicleSub(sub?.id);
  const attrs = vehicle ? [] : attrsFor(top?.id, sub?.id).filter((a) => a.t === "sel");
  const conds = condsFor(top?.id).filter((c) => c !== "Farketmez");
  const brands = cat && sub && vehicle ? brandsOf(cat, sub.id) : {};
  const set = (p: AlarmFilters) => setF((x) => { const n = { ...x, ...p }; for (const k of Object.keys(n)) if (!n[k]) delete n[k]; return n; });
  // Çoklu seçim (ürün durumu, özellikler): değerler virgülle saklanır, listedeki süzgeçle aynı.
  const toggle = (k: string, v: string) => { const cur = (f[k] ?? "").split(",").filter(Boolean); set({ [k]: (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(",") }); };
  const on = (k: string, v: string) => (f[k] ?? "").split(",").includes(v);

  const save = async () => {
    if (!catId) return toast("Kategori seçin.");
    setBusy(true);
    try {
      await api("/me/alarms", { body: { category_id: catId, filters: f } });
      toast("Alarm kuruldu. Uygun yeni talep gelince haber vereceğiz.");
      setCatId(""); setF({}); onSaved();
    } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="box"><div className="box-h"><h3>Yeni alarm</h3></div><div className="box-b">
      <div className="form-grid">
        <div className="fg full"><label htmlFor="al-top">Kategori *</label>
          <select className="sel" id="al-top" value={catId} onChange={(e) => { setCatId(e.target.value); setF((x) => ({ ...(x.city ? { city: x.city } : {}), ...(x.district ? { district: x.district } : {}), ...(x.neighbourhood ? { neighbourhood: x.neighbourhood } : {}), ...(x.bmin ? { bmin: x.bmin } : {}), ...(x.bmax ? { bmax: x.bmax } : {}), ...(x.q ? { q: x.q } : {}) })); }}>
            <option value="">Seçin</option>
            {categories.map((t) => <optgroup key={t.id} label={t.name}><option value={t.id}>{t.name} (tümü)</option>{t.subs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>)}
          </select></div>
        <div className="fg"><label htmlFor="al-c">İl</label><select className="sel" id="al-c" value={f.city ?? ""} onChange={(e) => set({ city: e.target.value, district: "", neighbourhood: "" })}><option value="">Tüm iller</option>{CITIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="fg"><label htmlFor="al-d">İlçe</label><select className="sel" id="al-d" value={f.district ?? ""} disabled={!f.city} onChange={(e) => set({ district: e.target.value, neighbourhood: "" })}><option value="">{f.city ? "Tüm ilçeler" : "Önce il seçin"}</option>{districts.map((x) => <option key={x}>{x}</option>)}</select></div>
        {f.district && <div className="fg"><label htmlFor="al-m">Mahalle</label><select className="sel" id="al-m" value={f.neighbourhood ?? ""} onChange={(e) => set({ neighbourhood: e.target.value })}><option value="">Tüm mahalleler</option>{hoods.map((x) => <option key={x}>{x}</option>)}</select></div>}
        <div className="fg"><label htmlFor="al-bmin">Alıcı bütçesi en az (TL)</label><input className="inp" id="al-bmin" type="number" inputMode="numeric" value={f.bmin ?? ""} onChange={(e) => set({ bmin: e.target.value })} /></div>
        <div className="fg"><label htmlFor="al-bmax">Alıcı bütçesi en fazla (TL)</label><input className="inp" id="al-bmax" type="number" inputMode="numeric" value={f.bmax ?? ""} onChange={(e) => set({ bmax: e.target.value })} /></div>
        <div className="fg full"><label htmlFor="al-q">Kelime (isteğe bağlı)</label><input className="inp" id="al-q" maxLength={60} value={f.q ?? ""} onChange={(e) => set({ q: e.target.value })} placeholder="Örn. deniz manzaralı, iPhone 15, 4x4" /><span className="hint">Talebin başlığında ya da açıklamasında bu kelime geçenler.</span></div>
        {vehicle && cat && (
          <>
            <div className="fg"><label htmlFor="al-mk">Marka</label><select className="sel" id="al-mk" value={f.arac_marka ?? ""} onChange={(e) => set({ arac_marka: e.target.value, arac_model: "" })}><option value="">Tüm markalar</option>{Object.keys(brands).map((b) => <option key={b}>{b}</option>)}</select></div>
            <div className="fg"><label htmlFor="al-md">Model</label><select className="sel" id="al-md" value={f.arac_model ?? ""} disabled={!f.arac_marka} onChange={(e) => set({ arac_model: e.target.value })}><option value="">Tüm modeller</option>{(brands[f.arac_marka ?? ""] ?? []).map((m) => <option key={m}>{m}</option>)}</select></div>
            <div className="fg"><label htmlFor="al-y">Elinizdeki aracın yılı</label><input className="inp" id="al-y" type="number" inputMode="numeric" value={f.arac_yil ?? ""} onChange={(e) => set({ arac_yil: e.target.value })} placeholder="Örn. 2019" /></div>
            <div className="fg"><label htmlFor="al-km">Kilometresi</label><input className="inp" id="al-km" type="number" inputMode="numeric" value={f.arac_km ?? ""} onChange={(e) => set({ arac_km: e.target.value })} /></div>
            <div className="fg"><label htmlFor="al-yk">Yakıt</label><select className="sel" id="al-yk" value={f.arac_yakit ?? ""} onChange={(e) => set({ arac_yakit: e.target.value })}><option value="">Farketmez</option>{cat.fuels.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div className="fg"><label htmlFor="al-vt">Vites</label><select className="sel" id="al-vt" value={f.arac_vites ?? ""} onChange={(e) => set({ arac_vites: e.target.value })}><option value="">Farketmez</option>{cat.gears.map((x) => <option key={x}>{x}</option>)}</select></div>
          </>
        )}
        {attrs.map((a) => (
          <div className="fg full" key={a.k}><label>{a.l} <span className="muted">(birden fazla seçilebilir)</span></label>
            <div className="chips">{a.o!.filter((o) => o !== "Farketmez").map((o) => (
              <button key={o} type="button" className={"chip" + (on(`a_${a.k}`, o) ? " on" : "")} aria-pressed={on(`a_${a.k}`, o)} onClick={() => toggle(`a_${a.k}`, o)}>{o}</button>
            ))}</div></div>
        ))}
        {catId && conds.length > 1 && (
          <div className="fg full"><label>Ürün durumu</label><div className="chips">{conds.map((c) => (
            <button key={c} type="button" className={"chip" + (on("cond", c) ? " on" : "")} aria-pressed={on("cond", c)} onClick={() => toggle("cond", c)}>{c}</button>
          ))}</div></div>
        )}
        <div className="fg full"><label>Seçenekler</label>
          <label className="chk"><input type="checkbox" checked={!!f.urgent} onChange={(e) => set({ urgent: e.target.checked ? "1" : "" })} />Yalnızca acil talepler</label>
          <label className="chk"><input type="checkbox" checked={f.buyer === "kurumsal"} onChange={(e) => set({ buyer: e.target.checked ? "kurumsal" : "" })} />Yalnızca kurumsal (faturalı) alıcılar</label>
        </div>
      </div>
      <button className="btn btn-bl" style={{ marginTop: 12 }} disabled={busy} onClick={() => void save()}>{busy ? "Kaydediliyor…" : "Alarm kur"}</button>
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Seçtiklerinize uyan yeni talep gelince sitedeki zil simgesinden ve (bağlıysa) SMS/e-posta ile haber veririz. Boş bıraktığınız alanlar "farketmez" sayılır.</p>
    </div></div>
  );
}
