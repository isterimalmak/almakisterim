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
// Nerede görünsün: her yerde, yalnızca telefonda, yalnızca bilgisayarda.
export type Show = "all" | "mobile" | "desktop";
export type HomeBlock =
  | { type: "builtin"; id: BuiltinId; hidden: boolean; show?: Show; texts?: Record<string, string> }
  | { type: "text"; id: string; hidden: boolean; show?: Show; title: string; text: string; cta: string; href: string | null; tone: Tone; align: "sol" | "orta" }
  | { type: "marquee"; id: string; hidden: boolean; show?: Show; text: string; bg: string; fg: string; href: string | null; speed?: number }
  | { type: "banner"; id: string; hidden: boolean; show?: Show; title: string; ad_ids: number[] }
  | { type: "showcase"; id: string; hidden: boolean; show?: Show; title: string; request_ids: number[]; speed: number }
  | { type: "catvitrin"; id: string; hidden: boolean; show?: Show; title: string; top: string; limit: number; include_ids: number[]; exclude_ids: number[] };
// Silinemeyen hazır kategori vitrinleri (gizlenebilir).
export const FIXED_IDS = ["vasita_vitrin", "emlak_vitrin"];
// Kayan vitrin hızı: 1 çok yavaş … 5 çok hızlı; bir kartın ekrandan geçme süresi (saniye).
// Kayan yazı bandının saniyedeki kayma (piksel) değeri; yazı ne kadar uzun olursa olsun aynı hızda okunur.
export const MQ_PX: Record<number, number> = { 1: 30, 2: 45, 3: 65, 4: 90, 5: 125 };
export const SPEEDS: [number, string, number][] = [[1, "Çok yavaş", 7], [2, "Yavaş", 5], [3, "Orta", 3.5], [4, "Hızlı", 2.4], [5, "Çok hızlı", 1.5]];
export const SHOW_TXT: Record<Show, string> = { all: "Her yerde", mobile: "Telefonda", desktop: "Bilgisayarda" };

// Hazır bölümlerin değiştirilebilen yazıları ve varsayılanları (boş bırakılırsa varsayılan görünür).
type F = { k: string; l: string; d: string; long?: boolean };
export const BUILTIN_TEXTS: Partial<Record<BuiltinId, F[]>> = {
  hero: [
    { k: "badge", l: "Üstteki küçük etiket", d: "Ücretsiz · 1 dakikada" },
    { k: "title", l: "Başlık", d: "Ne almak istiyorsunuz?" },
    { k: "sub", l: "Alt yazı", d: "İlanı siz verin, elinde ürünü olan satıcılar sizi arasın ya da mesaj atsın.", long: true },
    { k: "button", l: "Düğme yazısı", d: "Talep Oluştur" },
    { k: "ai", l: "Yapay zekâ açıklaması", d: "Konuşur gibi yazın: ne aradığınızı, bütçenizi, nerede istediğinizi ve olmazsa olmazlarınızı anlatın; formu yapay zekâ sizin için eksiksiz doldursun.", long: true },
    { k: "s1", l: "1. adım", d: "Ne aradığınızı yazın" }, { k: "s2", l: "2. adım", d: "Satıcılar size ulaşsın" }, { k: "s3", l: "3. adım", d: "En uygununu seçin" },
  ],
  urgent: [{ k: "title", l: "Başlık", d: "Acil Alım Talepleri" }, { k: "link", l: "Bağlantı yazısı", d: "Tüm acil talepler" }],
  vitrin: [{ k: "title", l: "Başlık", d: "Ana Sayfa Vitrini" }, { k: "link", l: "Bağlantı yazısı", d: "Tüm talepleri göster" }],
  latest: [{ k: "title", l: "Başlık", d: "Son Eklenen Talepler" }, { k: "link", l: "Bağlantı yazısı", d: "Tüm talepler" }],
  corp: [{ k: "title", l: "Başlık", d: "Kurumsal Alım Talepleri" }, { k: "link", l: "Bağlantı yazısı", d: "Tümü" }],
  launch: [
    { k: "title", l: "Başlık", d: "Lansman dönemi: numara görmek ücretsiz!" },
    { k: "text", l: "Metin", d: "Satıcılar şimdilik alıcıların numarasını kredi harcamadan görebilir. Erken katılan satıcılar ilk müşterileri kapar.", long: true },
    { k: "button", l: "Düğme yazısı", d: "Talep gelince haber ver" },
  ],
  how: [
    { k: "title", l: "Başlık", d: "Nasıl çalışır?" },
    { k: "s1t", l: "1. adım başlığı", d: "Talebinizi yazın" }, { k: "s1d", l: "1. adım açıklaması", d: "Ne aradığınızı ve bütçenizi bir cümleyle yazın." },
    { k: "s2t", l: "2. adım başlığı", d: "Satıcılar size ulaşsın" }, { k: "s2d", l: "2. adım açıklaması", d: "Elinde uygun ürün olan satıcılar sizi arar veya mesaj atar." },
    { k: "s3t", l: "3. adım başlığı", d: "Anlaşın" }, { k: "s3d", l: "3. adım açıklaması", d: "Satıcıyla konuşun, ürünü görün; aldığınızda talebinizi kapatın." },
  ],
  safe: [
    { k: "title", l: "Başlık", d: "Güvenli alışveriş" },
    { k: "p1", l: "1. madde", d: "Numaranız herkese açık değildir; yalnızca talebinizle ilgilenen sınırlı sayıda satıcı görür. İstediğiniz an gizleyebilirsiniz.", long: true },
    { k: "p2", l: "2. madde", d: "Kapora göndermeyin, ürünü görmeden ödeme yapmayın.", long: true },
  ],
};
// Bölümün yazısı: yöneticinin girdiği, yoksa varsayılan.
export function blockText(blocks: HomeBlock[], id: BuiltinId, k: string) {
  const b = blocks.find((x) => x.type === "builtin" && x.id === id);
  const v = b && b.type === "builtin" ? b.texts?.[k]?.trim() : "";
  return v || BUILTIN_TEXTS[id]?.find((f) => f.k === k)?.d || "";
}

export const blockName = (b: HomeBlock) =>
  b.type === "builtin" ? BUILTIN_NAMES[b.id] ?? b.id
    : b.type === "text" ? `Yazı: ${b.title || b.text.slice(0, 40) || "(boş)"}`
    : b.type === "marquee" ? `Kayan yazı: ${b.text.slice(0, 40)}`
    : b.type === "showcase" ? `Kayan vitrin: ${b.title || "Vitrin"} (${b.request_ids.length} talep)`
    : b.type === "catvitrin" ? `${b.title || "Kategori vitrini"} (vitrin)`
    : `Afiş${b.title ? `: ${b.title}` : ""} (${b.ad_ids.length} görsel)`;

export const isHidden = (blocks: HomeBlock[], id: string) => !!blocks.find((b) => b.id === id)?.hidden;
export const withHidden = (blocks: HomeBlock[], id: string, hidden: boolean) => blocks.map((b) => (b.id === id ? { ...b, hidden } : b));
export const saveHomeBlocks = (blocks: HomeBlock[]) => api<{ blocks: HomeBlock[] }>("/admin/home-blocks", { method: "PUT", body: { blocks } });
