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
