import { useEffect, useState } from "react";
import { api } from "./api";
import { fmt } from "./format";

// Araç talebi: birden fazla marka/model ve aralıklar (apps/web/lib/vehicles.ts ile aynı alanlar).
export type VehicleAttrs = {
  araclar?: { marka: string; model: string | null; paket?: string | null }[];
  yil_min?: number; yil_max?: number; km_max?: number;
  yakit?: string[]; vites?: string[]; kasa?: string[]; hasarsiz?: boolean;
};
export type VehicleCatalog = { cars: Record<string, string[]>; moto: Record<string, string[]>; variants: Record<string, string[]>; subs: Record<string, "car" | "moto">; fuels: string[]; gears: string[]; bodies: string[]; max: number };

let cache: Promise<VehicleCatalog> | null = null;
export function useVehicleCatalog() {
  const [c, setC] = useState<VehicleCatalog | null>(null);
  useEffect(() => {
    cache ??= api<VehicleCatalog>("/catalog/vehicles").catch((e) => { cache = null; throw e; });
    void cache.then(setC).catch(() => {});
  }, []);
  return c;
}
export const VEHICLE_SUBS = ["otomobil", "suv", "elektrikli", "ticari", "motosiklet"];
export const isVehicleSub = (sub: string | undefined) => !!sub && VEHICLE_SUBS.includes(sub);
export const brandsOf = (c: VehicleCatalog, sub: string) => (c.subs[sub] === "moto" ? c.moto : c.cars);
// Motor/paket seçenekleri ("BMW|3 Serisi" → 320i, 320d…); motosiklette yok.
export const variantsOf = (c: VehicleCatalog, sub: string, marka: string, model: string) => (c.subs[sub] === "moto" || !model ? [] : c.variants?.[`${marka}|${model}`] ?? []);
export const vehicleName = (x: { marka: string; model: string | null; paket?: string | null }) =>
  x.model ? [x.marka, x.model, x.paket].filter(Boolean).join(" ") : x.marka === "Diğer" ? "Diğer marka (açıklamada)" : `${x.marka} (tüm modeller)`;
export function yearTxt(a: VehicleAttrs) {
  if (a.yil_min && a.yil_max) return a.yil_min === a.yil_max ? `${a.yil_min} model` : `${a.yil_min}–${a.yil_max}`;
  if (a.yil_min) return `${a.yil_min} ve sonrası`;
  if (a.yil_max) return `${a.yil_max} ve öncesi`;
  return "";
}
/** Talep sayfasındaki satırlar */
export function vehicleRows(a: VehicleAttrs): [string, string][] {
  const out: [string, string][] = [];
  if (a.araclar?.length) out.push([a.araclar.length > 1 ? "Araçlar" : "Araç", a.araclar.map(vehicleName).join(", ")]);
  const y = yearTxt(a); if (y) out.push(["Model yılı", y]);
  if (a.km_max !== undefined) out.push(["Kilometre", `en fazla ${fmt(a.km_max)} km`]);
  if (a.yakit?.length) out.push(["Yakıt", a.yakit.join(", ")]);
  if (a.vites?.length) out.push(["Vites", a.vites.join(", ")]);
  if (a.kasa?.length) out.push(["Kasa tipi", a.kasa.join(", ")]);
  if (a.hasarsiz) out.push(["Hasar", "Hasarsız olsun"]);
  return out;
}
