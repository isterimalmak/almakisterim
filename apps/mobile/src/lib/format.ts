const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
export const fmt = (n: number) => new Intl.NumberFormat("tr-TR").format(Math.round(n));
export const price = (n: number) => `${fmt(n)} TL`;
export const dateTr = (iso: string) => { const d = new Date(iso); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
export function ago(iso: string, now = Date.now()) {
  const m = Math.max(1, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m} dk önce`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} saat önce` : `${Math.round(h / 24)} gün önce`;
}
export const place = (r: { city: string; district?: string }) => [r.city, r.district].filter(Boolean).join(" / ");
// "Farketmez" bilgisi gösterilmez (sitedeki gibi).
export const isAny = (v: unknown) => v == null || v === "" || (typeof v === "string" && /^farketmez$/i.test(v.trim())) || (Array.isArray(v) && (!v.length || v.every(isAny)));
