import { api } from "./api";

// Ana sayfa bölümleri (sunucudaki home-blocks.ts ile aynı yapı): hazır bölümler + yöneticinin eklediği yazı, afiş ve kayan yazı.
export const BUILTIN_NAMES = {
  hero: "Talep kutusu (Ne almak istiyorsunuz?)",
  urgent: "Acil Alım Talepleri",
  cats: "Kategori kutucukları (telefonda)",
  ads_m: "Sol sütun reklamları (telefonda)",
  center_ads: "Orta reklam alanı (Reklam Alanları'ndan)",
  vitrin: "Ana Sayfa Vitrini",
  latest: "Son Eklenen Talepler",
  corp: "Kurumsal Alım Talepleri",
  launch: "Lansman dönemi kutusu",
  how: "Nasıl çalışır?",
  safe: "Güvenli alışveriş",
} as const;
export type BuiltinId = keyof typeof BUILTIN_NAMES;
// Bilgisayarda sağ sütunda duran kutular; telefonda listedeki yerlerinde görünür.
export const SIDE_IDS: BuiltinId[] = ["launch", "how", "safe"];

export type Tone = "acik" | "lacivert" | "turuncu" | "yesil";
export type HomeBlock =
  | { type: "builtin"; id: BuiltinId; hidden: boolean }
  | { type: "text"; id: string; hidden: boolean; title: string; text: string; cta: string; href: string | null; tone: Tone; align: "sol" | "orta" }
  | { type: "marquee"; id: string; hidden: boolean; text: string; bg: string; fg: string; href: string | null }
  | { type: "banner"; id: string; hidden: boolean; title: string; ad_ids: number[] };

export const blockName = (b: HomeBlock) =>
  b.type === "builtin" ? BUILTIN_NAMES[b.id] ?? b.id
    : b.type === "text" ? `Yazı: ${b.title || b.text.slice(0, 40) || "(boş)"}`
    : b.type === "marquee" ? `Kayan yazı: ${b.text.slice(0, 40)}`
    : `Afiş${b.title ? `: ${b.title}` : ""} (${b.ad_ids.length} görsel)`;

export const isHidden = (blocks: HomeBlock[], id: string) => !!blocks.find((b) => b.id === id)?.hidden;
export const withHidden = (blocks: HomeBlock[], id: string, hidden: boolean) => blocks.map((b) => (b.id === id ? { ...b, hidden } : b));
export const saveHomeBlocks = (blocks: HomeBlock[]) => api<{ blocks: HomeBlock[] }>("/admin/home-blocks", { method: "PUT", body: { blocks } });
