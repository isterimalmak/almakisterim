import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { Category } from "./types";

// Ana sayfa bölümleri: sitenin Yönetim → Ana Sayfa Düzeni ayarı (apps/web/lib/home.ts ile aynı yapı ve varsayılan yazılar).
// Uygulama telefon görünümünü kullanır: "Yalnız bilgisayarda" seçilen bölümler gösterilmez.
export type BuiltinId = "hero" | "urgent" | "cats" | "ads_m" | "center_ads" | "vitrin" | "latest" | "corp" | "launch" | "how" | "safe";
export const BUILTIN_ORDER: BuiltinId[] = ["hero", "urgent", "cats", "ads_m", "center_ads", "vitrin", "latest", "corp", "launch", "how", "safe"];
export type Show = "all" | "mobile" | "desktop";
export type Tone = "acik" | "lacivert" | "turuncu" | "yesil";
export type HomeBlock =
  | { type: "builtin"; id: BuiltinId; hidden: boolean; show?: Show; texts?: Record<string, string> }
  | { type: "text"; id: string; hidden: boolean; show?: Show; title: string; text: string; cta: string; href: string | null; tone: Tone; align: "sol" | "orta" }
  | { type: "marquee"; id: string; hidden: boolean; show?: Show; text: string; bg: string; fg: string; href: string | null; speed?: number }
  | { type: "banner"; id: string; hidden: boolean; show?: Show; title: string; ad_ids: number[] }
  | { type: "showcase"; id: string; hidden: boolean; show?: Show; title: string; request_ids: number[]; speed: number }
  | { type: "catvitrin"; id: string; hidden: boolean; show?: Show; title: string; top: string; limit: number; include_ids: number[]; exclude_ids: number[] };

const DEFAULTS: Partial<Record<BuiltinId, Record<string, string>>> = {
  hero: {
    badge: "Ücretsiz · 1 dakikada", title: "Ne almak istiyorsunuz?", sub: "İlanı siz verin, elinde ürünü olan satıcılar sizi arasın ya da mesaj atsın.",
    button: "Talep Oluştur", ai: "Konuşur gibi yazın: ne aradığınızı, bütçenizi, nerede istediğinizi ve olmazsa olmazlarınızı anlatın; formu yapay zekâ sizin için eksiksiz doldursun.",
    s1: "Ne aradığınızı yazın", s2: "Satıcılar size ulaşsın", s3: "En uygununu seçin",
  },
  urgent: { title: "Acil Alım Talepleri", link: "Tüm acil talepler" },
  vitrin: { title: "Ana Sayfa Vitrini", link: "Tüm talepleri göster" },
  latest: { title: "Son Eklenen Talepler", link: "Tüm talepler" },
  corp: { title: "Kurumsal Alım Talepleri", link: "Tümü" },
  launch: { title: "Lansman dönemi: numara görmek ücretsiz!", text: "Satıcılar şimdilik alıcıların numarasını kredi harcamadan görebilir. Erken katılan satıcılar ilk müşterileri kapar.", button: "Talep gelince haber ver" },
  how: {
    title: "Nasıl çalışır?", s1t: "Talebinizi yazın", s1d: "Ne aradığınızı ve bütçenizi bir cümleyle yazın.", s2t: "Satıcılar size ulaşsın",
    s2d: "Elinde uygun ürün olan satıcılar sizi arar veya mesaj atar.", s3t: "Anlaşın", s3d: "Satıcıyla konuşun, ürünü görün; aldığınızda talebinizi kapatın.",
  },
  safe: { title: "Güvenli alışveriş", p1: "Numaranız herkese açık değildir; yalnızca talebinizle ilgilenen sınırlı sayıda satıcı görür. İstediğiniz an gizleyebilirsiniz.", p2: "Kapora göndermeyin, ürünü görmeden ödeme yapmayın." },
};
/** Bölümün yazısı: yöneticinin girdiği, yoksa varsayılan. */
export function blockText(blocks: HomeBlock[], id: BuiltinId, k: string) {
  const b = blocks.find((x) => x.type === "builtin" && x.id === id);
  const v = b && b.type === "builtin" ? b.texts?.[k]?.trim() : "";
  return v || DEFAULTS[id]?.[k] || "";
}

// Kategori renkleri (sitedeki apps/web/lib/catalog.ts THEME ile aynı).
const THEME: Record<string, { c: string; fc: string }> = {
  vasita: { c: "#E8EDFA", fc: "#1C3178" }, emlak: { c: "#E6F4EC", fc: "#18794E" }, elektronik: { c: "#EEE9FB", fc: "#5A3DB8" },
  ev: { c: "#FDF0E3", fc: "#A55A12" }, yedek: { c: "#EDEFF2", fc: "#454C57" }, hizmet: { c: "#FCEBEA", fc: "#B3261E" },
  ders: { c: "#E5F3F7", fc: "#0F6B85" }, sanayi: { c: "#FFF4D9", fc: "#8A5A00" }, moda: { c: "#FBE9F1", fc: "#A3235F" },
  bebek: { c: "#FDECEE", fc: "#B23A4B" }, spor: { c: "#E7F6EF", fc: "#1D7A55" }, toptan: { c: "#F0ECE6", fc: "#6B4F2A" },
};
export const theme = (top: string) => THEME[top] ?? { c: "#EDEFF2", fc: "#454C57" };

export type Ad = { id: number; title: string; link_url: string | null; media: { kind: "image" | "video"; url: string; thumb_url?: string | null }; device?: Show };
export type Site = {
  categories: Category[];
  browse?: { min_requests: number; show_counts_min: number };
  home_blocks?: HomeBlock[];
  home_urgent_box?: boolean;
  launch_mode?: boolean;
};
export type Tanitim = { items: Ad[]; center?: Ad[]; blok?: Ad[]; welcome?: Ad | null };

/** Ana sayfanın ayarları ve reklamları; aşağı çekince yenilenir. */
export function useHome() {
  const [site, setSite] = useState<Site | null>(null);
  const [ads, setAds] = useState<Tanitim | null>(null);
  const load = useCallback(async () => {
    await Promise.all([
      api<Site>("/categories").then(setSite).catch(() => setSite({ categories: [] })),
      api<Tanitim>("/tanitim").then(setAds).catch(() => setAds({ items: [] })),
    ]);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const blocks: HomeBlock[] = site?.home_blocks?.length ? site.home_blocks : BUILTIN_ORDER.map((id) => ({ type: "builtin", id, hidden: false }));
  const min = Math.max(1, site?.browse?.min_requests ?? 1);
  // Gezinme: yeterli açık talebi olan kategoriler (sitedeki gibi; hiç yoksa bütün kategoriler talep verme kısayolu olur).
  const browse = (site?.categories ?? []).filter((c) => c.active_count >= min);
  const count = (n: number | undefined) => (n != null && n >= (site?.browse?.show_counts_min ?? 0) ? n : null);
  // Uygulama telefon görünümüdür; bilgisayara ayrılmış reklamlar çizilmez.
  const forPhone = (list: Ad[] | undefined) => (list ?? []).filter((a) => a.device !== "desktop");
  return { site, blocks, browse, count, ads, forPhone, load };
}
