import { useEffect, useState } from "react";
import { api } from "./api";
import type { Category } from "./types";

let cache: Category[] | null = null;
/** Kategori ağacı (bir kez yüklenir). */
export function useCats() {
  const [cats, setCats] = useState<Category[] | null>(cache);
  useEffect(() => { if (!cache) api<{ categories: Category[] }>("/categories").then((d) => { cache = d.categories; setCats(d.categories); }).catch(() => setCats([])); }, []);
  return cats;
}

// Ödeme bölümlerinin görünürlüğü (yönetimden: Güvenli Al; kredi ve mağaza).
let ui: { show_safe: boolean; show_credits: boolean } | null = null;
export function usePaymentsUi() {
  const [v, setV] = useState(ui ?? { show_safe: true, show_credits: true });
  useEffect(() => {
    if (!ui) api<{ show_safe?: boolean; show_credits?: boolean }>("/categories").then((d) => { ui = { show_safe: d.show_safe !== false, show_credits: d.show_credits !== false }; setV(ui); }).catch(() => {});
  }, []);
  return v;
}
