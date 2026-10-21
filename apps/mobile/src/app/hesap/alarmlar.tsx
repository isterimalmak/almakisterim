import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { Picker } from "@/components/Picker";
import { Box, Btn, Empty, Err, Field } from "@/components/ui";
import { api } from "@/lib/api";
import { CITIES } from "@/lib/catalog";
import { confirm } from "@/lib/confirm";
import { fmt } from "@/lib/format";
import { openWebAuthed } from "@/lib/links";
import { C, R } from "@/lib/theme";
import { useCats } from "@/lib/useCats";
import { brandsOf, isVehicleSub, useVehicleCatalog, variantsOf } from "@/lib/vehicles";

type Alarm = { id: number; category_id: string; category_name: string; top_name: string | null; filters: Record<string, string> };
type F = Record<string, string>;

// Alarmdaki araç listesi "BMW:3 Serisi:320d,Audi:" biçiminde saklanır (model boşsa markanın bütün modelleri, paket boşsa modelin bütün paketleri) — sunucuyla aynı.
type Car = { marka: string; model: string; paket: string };
const parseCars = (s: string): Car[] => s.split(",").filter(Boolean).map((x) => { const [marka = "", model = "", paket = ""] = x.split(":"); return { marka, model, paket }; });
const carsTxt = (cs: Car[]) => cs.map((c) => `${c.marka}:${c.model}${c.paket ? `:${c.paket}` : ""}`).join(",");
const carName = (c: Car) => (c.model ? [c.marka, c.model, c.paket].filter(Boolean).join(" ") : `${c.marka} (tüm modeller)`);
const digits = (v: string) => v.replace(/\D/g, "");

/** Alarmın tek satırlık özeti (sitedeki alarmSummary ile aynı sıra). */
function summary(f: F) {
  const out = [[f.city ? f.city.split(",").join(", ") : "Tüm iller", f.district].filter(Boolean).join(" / ")];
  if (f.bmin || f.bmax) out.push(f.bmin && f.bmax ? `${fmt(+f.bmin)} – ${fmt(+f.bmax)} TL` : f.bmin ? `${fmt(+f.bmin)} TL ve üstü` : `en fazla ${fmt(+f.bmax!)} TL`);
  if (f.arac_marka) out.push([f.arac_marka, f.arac_model].filter(Boolean).join(" "));
  if (f.araclar) out.push(parseCars(f.araclar).map(carName).join(", "));
  if (f.arac_yil) out.push(`${f.arac_yil} model`);
  if (f.arac_km) out.push(`${fmt(+f.arac_km)} km`);
  if (f.arac_yakit) out.push(`Yakıt: ${f.arac_yakit.split(",").join(", ")}`);
  if (f.arac_vites) out.push(`Vites: ${f.arac_vites.split(",").join(", ")}`);
  if (f.q) out.push(`"${f.q}" geçen`);
  if (f.urgent) out.push("Yalnızca acil");
  return out;
}

/** Satıcı için: seçtiği kategoride, illerde, fiyat aralığında (araçta marka/model, yıl, km) yeni talep gelince bildirim alır. */
export default function Alarmlar() {
  const cats = useCats();
  const vc = useVehicleCatalog();
  const [items, setItems] = useState<Alarm[] | null>(null);
  const [cat, setCat] = useState("");
  const [f, setF] = useState<F>({});
  const [districts, setDistricts] = useState<string[]>([]);
  const [mk, setMk] = useState("");
  const [md, setMd] = useState("");
  const [pk, setPk] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { api<{ items: Alarm[] }>("/me/alarms").then((d) => setItems(d.items)).catch(() => setItems([])); }, []);
  useFocusEffect(load);

  const options = useMemo(() => (cats ?? []).flatMap((t) => [{ value: t.id, label: `${t.name} (tümü)`, top: t.id }, ...(t.subs ?? []).map((s) => ({ value: s.id, label: `${t.name} › ${s.name}`, top: t.id }))]), [cats]);
  const top = options.find((o) => o.value === cat)?.top;
  // Vasıtada alt kategori seçilmese de marka/model sorulur (otomobil, SUV, ticari… hepsinde aranır).
  const vehicle = top === "vasita" ? cat === "vasita" || isVehicleSub(cat) : false;
  const brands = vc && vehicle ? (cat === "vasita" ? vc.cars : brandsOf(vc, cat)) : {};
  const cities = (f.city ?? "").split(",").filter(Boolean);
  const oneCity = cities.length === 1 ? cities[0]! : "";
  const cars = parseCars(f.araclar ?? "");
  useEffect(() => {
    setDistricts([]); if (!oneCity) return;
    api<{ districts: string[] }>(`/locations?il=${encodeURIComponent(oneCity)}`).then((d) => setDistricts(d.districts)).catch(() => {});
  }, [oneCity]);

  const set = (p: F) => setF((x) => { const n = { ...x, ...p }; for (const k of Object.keys(n)) if (!n[k]) delete n[k]; return n; });
  const pick = (id: string) => { setCat(id); setF((x) => Object.fromEntries(Object.entries(x).filter(([k]) => ["city", "district", "bmin", "bmax", "q", "urgent"].includes(k)))); setMk(""); setMd(""); setPk(""); };
  const addCity = (c: string) => { if (c && !cities.includes(c)) set({ city: [...cities, c].join(","), district: "" }); };
  const addCar = () => {
    if (!mk) return;
    const p = md ? pk : "";
    // Aynı araç ya da onu kapsayan/kapsadığı seçim yerine yenisi konur (bütün model ↔ tek paket).
    const next = cars.filter((c) => !(c.marka === mk && (!md || !c.model || (c.model === md && (!p || !c.paket || c.paket === p)))));
    set({ araclar: carsTxt([...next, { marka: mk, model: md, paket: p }]) }); setMk(""); setMd(""); setPk("");
  };
  const toggle = (k: "arac_yakit" | "arac_vites", v: string) => { const cur = (f[k] ?? "").split(",").filter(Boolean); set({ [k]: (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(",") }); };

  const add = async () => {
    setBusy(true); setErr("");
    try {
      // Listeye eklenmeden bırakılan marka/model de alarma girsin.
      const filters = { ...f, ...(mk ? { araclar: carsTxt([...cars, { marka: mk, model: md, paket: md ? pk : "" }]) } : {}) };
      await api("/me/alarms", { body: { category_id: cat, filters } });
      setCat(""); setF({}); setMk(""); setMd(""); setPk(""); load();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const del = async (a: Alarm) => {
    if (!(await confirm("Alarmı sil", `${a.category_name} alarmı silinsin mi?`, "Sil", true))) return;
    await api(`/me/alarms/${a.id}`, { method: "DELETE" }).catch(() => {}); load();
  };
  const chip = (on: boolean, text: string, onPress: () => void, label?: string) => (
    <Pressable key={text} accessibilityRole="checkbox" accessibilityLabel={label ?? text} accessibilityState={{ checked: on }} onPress={onPress}
      style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: R.pill, backgroundColor: on ? C.navy : C.bg }}>
      <Text style={{ color: on ? "#fff" : C.navy, fontWeight: "700" }}>{text}</Text>
    </Pressable>
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Box title="Yeni alarm kur">
        <Text style={{ color: C.muted, fontSize: 13 }}>Seçtiğiniz süzgeçlere uyan yeni talep yayınlanınca telefonunuza bildirim gelir.</Text>
        <Picker label="Kategori *" value={cat} options={options} onChange={pick} />

        <Text style={{ fontSize: 13, fontWeight: "700", color: C.navy }}>İller (birden fazla seçebilirsiniz)</Text>
        {cities.length ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{cities.map((c) => chip(true, `${c} ✕`, () => set({ city: cities.filter((x) => x !== c).join(","), district: "" }), `${c} ilini kaldır`))}</View> : null}
        <Picker label="İl ekle" value="" placeholder={cities.length ? "Bir il daha ekle" : "Tüm Türkiye"} options={CITIES.filter((c) => !cities.includes(c)).map((c) => ({ value: c, label: c }))} onChange={addCity} />
        {oneCity ? <Picker label="İlçe" value={f.district ?? ""} placeholder="Tüm ilçeler" options={[{ value: "", label: "Tüm ilçeler" }, ...districts.map((d) => ({ value: d, label: d }))]} onChange={(d) => set({ district: d })} /> : null}

        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}><Field label="En az fiyat (TL)" value={f.bmin ?? ""} onChangeText={(v) => set({ bmin: digits(v) })} keyboardType="number-pad" /></View>
          <View style={{ flex: 1 }}><Field label="En çok fiyat (TL)" value={f.bmax ?? ""} onChangeText={(v) => set({ bmax: digits(v) })} keyboardType="number-pad" /></View>
        </View>

        {vehicle && vc ? (
          <>
            <Text style={{ fontSize: 13, fontWeight: "700", color: C.navy }}>Elinizdeki araçlar (boş bırakırsanız bütün markalar)</Text>
            {cars.map((c) => (
              <View key={`${c.marka}:${c.model}:${c.paket}`} style={{ flexDirection: "row", justifyContent: "space-between", backgroundColor: C.bg, borderRadius: R.md, padding: 10 }}>
                <Text style={{ fontWeight: "700" }}>{carName(c)}</Text>
                <Text accessibilityRole="button" accessibilityLabel={`${carName(c)} kaldır`} style={{ color: C.red, fontWeight: "700" }} onPress={() => set({ araclar: carsTxt(cars.filter((x) => x !== c)) })}>Kaldır</Text>
              </View>))}
            <Picker label="Marka" value={mk} options={Object.keys(brands).map((b) => ({ value: b, label: b }))} onChange={(b) => { setMk(b); setMd(""); setPk(""); }} />
            {mk && brands[mk]?.length ? <Picker label="Model" value={md} placeholder="Tüm modeller" options={[{ value: "", label: "Tüm modeller" }, ...brands[mk]!.map((m) => ({ value: m, label: m }))]} onChange={(m) => { setMd(m); setPk(""); }} /> : null}
            {variantsOf(vc, cat, mk, md).length ? <Picker label="Motor / paket" value={pk} placeholder="Tüm paketler" options={[{ value: "", label: "Tüm paketler" }, ...variantsOf(vc, cat, mk, md).map((v) => ({ value: v, label: v }))]} onChange={setPk} /> : null}
            <Btn title="+ Aracı listeye ekle" kind="wh" disabled={!mk} onPress={addCar} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}><Field label="Aracınızın model yılı" value={f.arac_yil ?? ""} onChangeText={(v) => set({ arac_yil: digits(v).slice(0, 4) })} keyboardType="number-pad" /></View>
              <View style={{ flex: 1 }}><Field label="Aracınızın km'si" value={f.arac_km ?? ""} onChangeText={(v) => set({ arac_km: digits(v) })} keyboardType="number-pad" /></View>
            </View>
            {([["arac_yakit", "Yakıt", vc.fuels], ["arac_vites", "Vites", vc.gears]] as const).map(([k, l, opts]) => (
              <View key={k} style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: C.navy }}>{l}</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{opts.map((o) => chip((f[k] ?? "").split(",").includes(o), o, () => toggle(k, o)))}</View>
              </View>))}
          </>) : null}

        <Field label="Başlıkta veya açıklamada geçen kelime (isteğe bağlı)" value={f.q ?? ""} onChangeText={(v) => set({ q: v })} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: C.text }}>Yalnızca acil talepler</Text>
          <Switch accessibilityLabel="Yalnızca acil talepler" value={!!f.urgent} onValueChange={(v) => set({ urgent: v ? "1" : "" })} />
        </View>
        {err ? <Err text={err} /> : null}
        <Btn title="Alarm kur" busy={busy} disabled={!cat} onPress={add} />
        <Text accessibilityRole="link" style={{ color: C.muted, fontSize: 12 }} onPress={() => void openWebAuthed("/bana-ozel?s=alarm")}>Kategoriye özel süzgeçler (oda sayısı, imar durumu…) için sitedeki alarm formunu kullanabilirsiniz ›</Text>
      </Box>
      <Box title="Alarmlarım">
        {!items?.length ? <Empty text="Henüz alarmınız yok." /> : items.map((a) => (
          <View key={a.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, borderBottomColor: C.bg, paddingBottom: 8 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontWeight: "700", color: C.navy }}>{a.top_name ? `${a.top_name} › ` : ""}{a.category_name}</Text>
              <Text style={{ color: C.muted, fontSize: 12 }}>{summary(a.filters ?? {}).join(" · ")}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`${a.category_name} alarmını sil`} onPress={() => void del(a)} style={{ padding: 8 }}><Text style={{ color: C.red, fontWeight: "700" }}>Sil</Text></Pressable>
          </View>))}
      </Box>
    </ScrollView>
  );
}
