import data from "./locations.json" with { type: "json" };

// İl → ilçe → mahalle (PTT listesi). Talep verirken ve satıcı ararken aynı adlar kullanılır.
export const LOCATIONS = data as Record<string, Record<string, string[]>>;

const fold = (s: string) => s.toLocaleLowerCase("tr").replace(/\s+/g, " ").trim();

// Kullanıcının yazdığı ilçe/mahalle adını listedeki yazıma çevirir; yoksa null.
export function matchDistrict(city: string, raw: string): string | null {
  const n = fold(raw);
  return Object.keys(LOCATIONS[city] ?? {}).find((d) => fold(d) === n) ?? null;
}
export function matchNeighbourhood(city: string, district: string, raw: string): string | null {
  const n = fold(raw).replace(/ (mahallesi|mah\.?)$/, "");
  return (LOCATIONS[city]?.[district] ?? []).find((m) => fold(m) === n) ?? null;
}

// Yalnızca tek bir ilde geçen ilçe adları: metinde "Kadıköy" geçerse il İstanbul'dur.
const uniqueDistricts = new Map<string, { city: string; district: string } | null>();
for (const [city, ds] of Object.entries(LOCATIONS)) {
  for (const d of Object.keys(ds)) {
    const k = fold(d);
    uniqueDistricts.set(k, uniqueDistricts.has(k) ? null : { city, district: d });
  }
}

// Serbest metinden ilçe bulur (il biliniyorsa o ilin ilçeleri; bilinmiyorsa yalnızca tek ilde geçen ilçeler).
export function findDistrictInText(text: string, city: string | null): { city: string; district: string } | null {
  const t = ` ${fold(text).replace(/[.,;:!?()'’"/]/g, " ")} `;
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // "Kadıköy", "Kadıköy'de", "Kadıköyde", "Kadıköydeki" eşleşir; "Kadıköylü" gibi başka sözcükler eşleşmez.
  const has = (d: string) => new RegExp(`\\s${esc(fold(d))}(?:de|da|te|ta|den|dan|ten|tan|deki|daki)?\\s`).test(t);
  if (city) {
    const d = Object.keys(LOCATIONS[city] ?? {}).sort((a, b) => b.length - a.length).find(has);
    return d ? { city, district: d } : null;
  }
  for (const [k, v] of uniqueDistricts) if (v && v.district !== "Merkez" && has(k)) return v;
  return null;
}
