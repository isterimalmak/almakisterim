const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

export const fmt = (n: number) => new Intl.NumberFormat("tr-TR").format(Math.round(n));
// Talepte tek fiyat gösterilir (eski aralıklı taleplerde de yalnız fiyat).
export const budgetTxt = (_min: number | null, max: number) => `${fmt(max)} TL`;

export function dateTr(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function ago(iso: string, now = Date.now()): string {
  const m = Math.max(1, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m} dk önce`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} saat önce`;
  return `${Math.round(h / 24)} gün önce`;
}

export function leftTxt(iso: string, now = Date.now()): string {
  const h = Math.max(0, (new Date(iso).getTime() - now) / 3600e3);
  if (h <= 0) return "Süresi doldu";
  return h >= 24 ? `${Math.floor(h / 24)} gün` : `${Math.floor(h)} saat`;
}

export function leftParts(iso: string, now = Date.now()) {
  const ms = Math.max(0, new Date(iso).getTime() - now);
  return { d: Math.floor(ms / 86400e3), h: Math.floor((ms % 86400e3) / 3600e3), m: Math.floor((ms % 3600e3) / 60e3) };
}

export function initials(name: string): string {
  return name.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü ]/g, "").split(" ").filter(Boolean).map((x) => x[0]).join("").slice(0, 2).toLocaleUpperCase("tr") || "Ü";
}

export const isNew = (iso: string, now = Date.now()) => now - new Date(iso).getTime() < 3 * 3600e3;
