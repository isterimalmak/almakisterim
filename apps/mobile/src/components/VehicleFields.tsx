import { useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { brandsOf, useVehicleCatalog, vehicleName, type VehicleAttrs } from "@/lib/vehicles";
import { C, R } from "@/lib/theme";
import { Picker } from "./Picker";
import { Btn, Field } from "./ui";

const num = (v: string) => (v.replace(/\D/g, "") ? Number(v.replace(/\D/g, "")) : undefined);

/** Araç talebi alanları: bir ya da birden fazla marka/model, yıl ve kilometre aralığı, yakıt, vites. */
export function VehicleFields({ sub, value, onChange }: { sub: string; value: VehicleAttrs; onChange: (v: VehicleAttrs) => void }) {
  const cat = useVehicleCatalog();
  const [marka, setMarka] = useState("");
  const [model, setModel] = useState("");
  if (!cat) return null;
  const brands = brandsOf(cat, sub);
  const cars = value.araclar ?? [];
  const set = (p: Partial<VehicleAttrs>) => onChange({ ...value, ...p });
  const toggle = (k: "yakit" | "vites", v: string) => { const cur = value[k] ?? []; set({ [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] }); };
  const add = () => {
    if (!marka) return;
    const x = { marka, model: model || null };
    if (!cars.some((c) => c.marka === x.marka && c.model === x.model)) set({ araclar: [...cars, x].slice(0, cat.max) });
    setMarka(""); setModel("");
  };
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 13, fontWeight: "700", color: C.navy }}>Aradığınız araç(lar)</Text>
      {cars.map((c) => (
        <View key={`${c.marka}|${c.model}`} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.bg, borderRadius: R.md, padding: 10 }}>
          <Text style={{ fontWeight: "700", color: C.text }}>{vehicleName(c)}</Text>
          <Text accessibilityRole="button" accessibilityLabel={`${vehicleName(c)} kaldır`} style={{ color: C.red, fontWeight: "700" }} onPress={() => set({ araclar: cars.filter((y) => y !== c) })}>Kaldır</Text>
        </View>))}
      {cars.length < cat.max ? (
        <>
          <Picker label="Marka" value={marka} options={Object.keys(brands).map((b) => ({ value: b, label: b }))} onChange={(b) => { setMarka(b); setModel(""); }} />
          {marka && brands[marka]?.length ? <Picker label="Model" value={model} placeholder="Tüm modeller" options={[{ value: "", label: "Tüm modeller" }, ...brands[marka]!.map((m) => ({ value: m, label: m }))]} onChange={setModel} /> : null}
          <Btn title={cars.length ? "+ Bir araç daha ekle" : "+ Aracı ekle"} kind="wh" disabled={!marka} onPress={add} />
          {cars.length ? <Text style={{ color: C.muted, fontSize: 12 }}>Birden fazla araç seçerseniz her biri ayrı talep olarak yayınlanır.</Text> : null}
        </>) : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}><Field label="Model yılı (en az)" value={value.yil_min ? String(value.yil_min) : ""} onChangeText={(v) => set({ yil_min: num(v) })} keyboardType="number-pad" maxLength={4} /></View>
        <View style={{ flex: 1 }}><Field label="Model yılı (en çok)" value={value.yil_max ? String(value.yil_max) : ""} onChangeText={(v) => set({ yil_max: num(v) })} keyboardType="number-pad" maxLength={4} /></View>
      </View>
      <Field label="En fazla kilometre" value={value.km_max !== undefined ? String(value.km_max) : ""} onChangeText={(v) => set({ km_max: num(v) })} keyboardType="number-pad" />
      {([["yakit", "Yakıt", cat.fuels], ["vites", "Vites", cat.gears]] as const).map(([k, l, opts]) => (
        <View key={k} style={{ gap: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: C.navy }}>{l} (birden fazla seçebilirsiniz)</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{opts.map((o) => {
            const on = (value[k] ?? []).includes(o);
            return (<Pressable key={o} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => toggle(k, o)}
              style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: R.pill, backgroundColor: on ? C.navy : C.bg }}>
              <Text style={{ color: on ? "#fff" : C.navy, fontWeight: "700" }}>{o}</Text></Pressable>);
          })}</View>
        </View>))}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: C.text }}>Hasarsız olsun</Text>
        <Switch accessibilityLabel="Hasarsız olsun" value={!!value.hasarsiz} onValueChange={(v) => set({ hasarsiz: v || undefined })} />
      </View>
    </View>
  );
}
