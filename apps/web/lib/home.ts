// Ana sayfanın orta sütunundaki bölümler: yönetici sırasını değiştirir ve istediğini gizler (sunucudaki HOME_SECTIONS ile aynı adlar).
export const HOME_SECTIONS = [
  { id: "hero", name: "Talep kutusu (Ne almak istiyorsunuz?)" },
  { id: "urgent", name: "Acil Alım Talepleri" },
  { id: "cats", name: "Kategori kutucukları (telefonda)" },
  { id: "ads_m", name: "Sol sütun reklamları (telefonda)" },
  { id: "center_ads", name: "Orta reklam alanı (resim/video)" },
  { id: "vitrin", name: "Ana Sayfa Vitrini" },
  { id: "latest", name: "Son Eklenen Talepler" },
  { id: "corp", name: "Kurumsal Alım Talepleri" },
] as const;
export type HomeSection = (typeof HOME_SECTIONS)[number]["id"];

// Kayıtlı sıra + listede olmayan (sonradan eklenen) bölümler sona.
export function homeOrder(saved: string[]): HomeSection[] {
  const ids = HOME_SECTIONS.map((s) => s.id) as HomeSection[];
  const known = saved.filter((x): x is HomeSection => ids.includes(x as HomeSection));
  return [...new Set([...known, ...ids])];
}
export const sectionName = (id: string) => HOME_SECTIONS.find((s) => s.id === id)?.name ?? id;
