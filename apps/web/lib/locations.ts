"use client";

import { useEffect, useState } from "react";
import { api } from "./api";

// İl seçilince ilçeler, ilçe seçilince mahalleler sunucudan gelir; aynı sayfada tekrar istenmez.
const cache = new Map<string, Promise<string[]>>();
function load(il: string, ilce?: string) {
  const key = `${il}|${ilce ?? ""}`;
  let p = cache.get(key);
  if (!p) {
    const qs = new URLSearchParams({ il, ...(ilce ? { ilce } : {}) });
    p = api<{ districts?: string[]; neighbourhoods?: string[] }>(`/locations?${qs}`).then((r) => r.districts ?? r.neighbourhoods ?? []);
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

export function useDistricts(il: string) {
  const [list, setList] = useState<string[]>([]);
  useEffect(() => {
    if (!il) { setList([]); return; }
    let on = true;
    void load(il).then((x) => on && setList(x)).catch(() => on && setList([]));
    return () => { on = false; };
  }, [il]);
  return list;
}

export function useNeighbourhoods(il: string, ilce: string) {
  const [list, setList] = useState<string[]>([]);
  useEffect(() => {
    if (!il || !ilce) { setList([]); return; }
    let on = true;
    void load(il, ilce).then((x) => on && setList(x)).catch(() => on && setList([]));
    return () => { on = false; };
  }, [il, ilce]);
  return list;
}

export const placeTxt = (r: { city: string; district?: string; neighbourhood?: string }) =>
  [r.city, r.district || "", r.neighbourhood || ""].filter(Boolean).join(" / ");
