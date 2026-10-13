"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import { fmt } from "./format";

// Araç talebi: birden fazla marka/model ve aralıklar. Sunucudaki doğrulamayla aynı alanlar.
export type VehicleAttrs = {
  araclar?: { marka: string; model: string | null }[];
  yil_min?: number; yil_max?: number; km_max?: number;
  yakit?: string[]; vites?: string[]; kasa?: string[]; hasarsiz?: boolean;
};

export type VehicleCatalog = {
  cars: Record<string, string[]>; moto: Record<string, string[]>; subs: Record<string, "car" | "moto">;
  fuels: string[]; gears: string[]; bodies: string[]; max: number;
};

// Katalog bir kez indirilir, sayfalar arasında paylaşılır.
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

export function vehicleNames(a: VehicleAttrs) {
  return (a.araclar ?? []).map((x) => (x.model ? `${x.marka} ${x.model}` : `${x.marka} (tüm modeller)`));
}

export function yearTxt(a: VehicleAttrs) {
  if (a.yil_min && a.yil_max) return a.yil_min === a.yil_max ? `${a.yil_min} model` : `${a.yil_min}–${a.yil_max}`;
  if (a.yil_min) return `${a.yil_min} ve sonrası`;
  if (a.yil_max) return `${a.yil_max} ve öncesi`;
  return "";
}

// Listede tek satırlık özet: "BMW 3 Serisi, Audi A4 · 2018 ve sonrası · en fazla 100.000 km · Dizel/Hibrit · Otomatik"
export function vehicleLine(a: VehicleAttrs) {
  const parts = [vehicleNames(a).join(", ") || "Marka farketmez", yearTxt(a)];
  if (a.km_max !== undefined) parts.push(`en fazla ${fmt(a.km_max)} km`);
  if (a.yakit?.length) parts.push(a.yakit.join("/"));
  if (a.vites?.length) parts.push(a.vites.join("/"));
  if (a.kasa?.length) parts.push(a.kasa.join("/"));
  if (a.hasarsiz) parts.push("Hasarsız");
  return parts.filter(Boolean).join(" · ");
}
