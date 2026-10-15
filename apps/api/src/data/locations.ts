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
  // Birden fazla ilçe geçerse ("Bodrum Milas'ta") eki alan ilçe, o da yoksa en son yazılan seçilir.
  const suffixed = (d: string) => new RegExp(`\\s${esc(fold(d))}(?:de|da|te|ta|den|dan|ten|tan|deki|daki|\\s(?:de|da|te|ta|den|dan|ten|tan|deki|daki))\\s`).test(t);
  const pickBest = <T extends { district: string }>(hits: T[]) => hits.find((h) => suffixed(h.district))
    ?? hits.sort((a, b) => t.lastIndexOf(` ${fold(b.district)}`) - t.lastIndexOf(` ${fold(a.district)}`))[0] ?? null;
  if (city) {
    const ds = Object.keys(LOCATIONS[city] ?? {}).filter(has).map((d) => ({ city, district: d }));
    return pickBest(ds);
  }
  const hits: { city: string; district: string }[] = [];
  for (const [k, v] of uniqueDistricts) if (v && v.district !== "Merkez" && has(k)) hits.push(v);
  return pickBest(hits);
}

// İlçe adından il: yalnızca tek ilde geçen ilçeler ("Kadıköy" → İstanbul; "Merkez" gibi ortak adlar çözülmez).
export function cityOfDistrict(raw: string): { city: string; district: string } | null {
  return uniqueDistricts.get(fold(raw)) ?? null;
}

// Serbest metinden mahalle: ilçe biliniyorsa o ilçenin, il biliniyorsa ilin, ikisi de yoksa bütün Türkiye'nin mahalleleri aranır;
// ad yalnızca tek yerde geçiyorsa kabul edilir. "Caddebostan'da 2+1" → İstanbul / Kadıköy / Caddebostan.
// Kısa ve sık geçen adlar ("Merkez", "Cumhuriyet") yanlış eşleşmesin diye atlanır.
const COMMON_HOODS = new Set(["merkez", "cumhuriyet", "atatürk", "yeni", "fatih", "istiklal", "hürriyet", "yenimahalle", "çarşı", "kale", "orta", "aşağı", "yukarı",
  "gazi", "zafer", "barış", "pazar", "mevlana", "yıldız", "güzelyalı", "kurtuluş", "istasyon", "sanayi", "bahçelievler", "esentepe", "yenişehir", "camikebir"]);
type Hood = { city: string; district: string; neighbourhood: string };
const HOODS = new Map<string, Hood[]>();
for (const [city, ds] of Object.entries(LOCATIONS)) {
  for (const [district, ms] of Object.entries(ds)) {
    for (const m of ms) {
      const k = fold(m);
      if (k.length < 5 || COMMON_HOODS.has(k)) continue;
      const list = HOODS.get(k) ?? [];
      list.push({ city, district, neighbourhood: m });
      HOODS.set(k, list);
    }
  }
}
const SUFFIX = /(?:mahallesi|mah|de|da|te|ta|den|dan|ten|tan|deki|daki)$/;

export function findNeighbourhoodInText(text: string, city: string | null, district: string | null): Hood | null {
  const words = fold(text).replace(/[.,;:!?()'’"/]/g, " ").split(" ").filter(Boolean);
  let best: Hood | null = null;
  // 1-3 sözcüklük parçalar ("Yeni Bostancı", "19 Mayıs") ekleriyle ve eksiz denenir; en uzun eşleşme seçilir.
  for (let n = 3; n >= 1 && !best; n--) {
    for (let i = 0; i + n <= words.length && !best; i++) {
      const raw = words.slice(i, i + n).join(" ");
      for (const k of new Set([raw, raw.replace(SUFFIX, "").trim(), raw.replace(/ mahallesi$| mah$/, "")])) {
        const hits = (HOODS.get(k) ?? []).filter((h) => (!city || h.city === city) && (!district || h.district === district));
        if (hits.length === 1) { best = hits[0]!; break; }
      }
    }
  }
  return best;
}
