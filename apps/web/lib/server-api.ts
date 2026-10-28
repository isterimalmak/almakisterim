import { cache } from "react";
import type { SiteData } from "@/components/Session";
// Sunucuda çalışan sayfalar (blog) API'ye doğrudan bağlanır; adres derleme sırasında gömülür (next.config.ts → env).
const ORIGIN = process.env.API_ORIGIN ?? "http://localhost:8080";

export async function serverApi<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${ORIGIN}/api${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// Kategoriler ve site ayarları (/api/categories): aynı istekte düzen ve sayfa birlikte kullanır, bir kez alınır.
export const siteData = cache(() => serverApi<SiteData>("/categories"));
