import { vehicleLine, type VehicleAttrs } from "./vehicles";
// Kategoriye özel özellikler (filtre ve talep formunda kullanılır) ve görsel ayarlar.
export type Attr = { k: string; l: string; t: "sel" | "num"; o?: string[] };

export const ATTRS: Record<string, Attr[]> = {
  emlak: [
    { k: "oda", l: "Oda sayısı", t: "sel", o: ["1+0", "1+1", "2+1", "3+1", "4+1 ve üzeri"] },
    { k: "m2", l: "m² (en az)", t: "num" },
    { k: "esya", l: "Eşya durumu", t: "sel", o: ["Eşyalı", "Eşyasız", "Farketmez"] },
  ],
  elektronik: [
    { k: "marka", l: "Marka", t: "sel", o: ["Apple", "Samsung", "Xiaomi", "Sony", "LG", "Lenovo", "Asus", "HP", "Farketmez"] },
    { k: "hafiza", l: "Hafıza", t: "sel", o: ["64 GB", "128 GB", "256 GB", "512 GB", "1 TB+"] },
    { k: "garanti", l: "Garanti", t: "sel", o: ["Var", "Farketmez"] },
  ],
};

const F = "Farketmez";
const ODA: Attr = { k: "oda", l: "Oda sayısı", t: "sel", o: ["1+0", "1+1", "2+1", "3+1", "4+1 ve üzeri"] };
const M2: Attr = { k: "m2", l: "m² (en az)", t: "num" };
const ISITMA: Attr = { k: "isitma", l: "Isıtma", t: "sel", o: ["Kombi", "Merkezi", "Yerden ısıtma", "Klima", "Soba", F] };
const GARANTI: Attr = { k: "garanti", l: "Garanti", t: "sel", o: ["Var", F] };
const HAFIZA: Attr = { k: "hafiza", l: "Hafıza", t: "sel", o: ["64 GB", "128 GB", "256 GB", "512 GB", "1 TB+", F] };
const CINSIYET: Attr = { k: "cinsiyet", l: "Kimin için", t: "sel", o: ["Kadın", "Erkek", "Çocuk", "Unisex", F] };

// Alt kategoriye özel özellikler: arsada oda sayısı, televizyonda hafıza gibi alakasız alanlar çıkmaz.
// Burada olmayan alt kategoride üst kategorinin (ATTRS) alanları kullanılır.
export const SUB_ATTRS: Record<string, Attr[]> = {
  satilik: [ODA, M2, { k: "bina_yasi", l: "Bina yaşı (en fazla)", t: "num" }, ISITMA],
  kiralik: [ODA, M2, { k: "esya", l: "Eşya durumu", t: "sel", o: ["Eşyalı", "Eşyasız", F] }, ISITMA],
  gunluk: [ODA, { k: "kisi", l: "Kişi sayısı", t: "num" }],
  arsa: [M2, { k: "imar", l: "İmar durumu", t: "sel", o: ["Konut", "Ticari", "Tarla", "Bağ & Bahçe", "Sanayi", "Turizm", F] }, { k: "tapu", l: "Tapu durumu", t: "sel", o: ["Müstakil tapu", "Hisseli tapu", F] }],
  isyeri: [{ k: "tip", l: "İşyeri tipi", t: "sel", o: ["Dükkan & Mağaza", "Ofis", "Depo", "Fabrika & Atölye", "Plaza katı", F] }, M2],
  telefon: [{ k: "marka", l: "Marka", t: "sel", o: ["Apple", "Samsung", "Xiaomi", "Huawei", "Oppo", "Realme", F] }, HAFIZA, GARANTI],
  bilgisayar: [{ k: "tip", l: "Tip", t: "sel", o: ["Dizüstü", "Masaüstü", "Hepsi bir arada", F] }, { k: "marka", l: "Marka", t: "sel", o: ["Apple", "Lenovo", "Asus", "HP", "Dell", "Acer", "MSI", "Monster", F] },
    { k: "ram", l: "RAM", t: "sel", o: ["8 GB", "16 GB", "32 GB ve üzeri", F] }, GARANTI],
  tablet: [{ k: "marka", l: "Marka", t: "sel", o: ["Apple", "Samsung", "Xiaomi", "Lenovo", "Huawei", F] }, HAFIZA, GARANTI],
  tv: [{ k: "ekran", l: "Ekran boyutu", t: "sel", o: ["32-43 inç", "50-55 inç", "65 inç ve üzeri", F] }, { k: "marka", l: "Marka", t: "sel", o: ["Samsung", "LG", "Sony", "Philips", "TCL", "Vestel", F] }, GARANTI],
  kamera: [{ k: "tip", l: "Tip", t: "sel", o: ["Fotoğraf makinesi", "Aksiyon kamerası", "Video kamera", "Lens", F] }, { k: "marka", l: "Marka", t: "sel", o: ["Canon", "Nikon", "Sony", "Fujifilm", "GoPro", F] }],
  oyun: [{ k: "model", l: "Konsol", t: "sel", o: ["PlayStation 5", "PlayStation 4", "Xbox Series X/S", "Nintendo Switch", F] }],
  giyim: [CINSIYET, { k: "beden", l: "Beden", t: "sel", o: ["XS", "S", "M", "L", "XL", "XXL ve üzeri", F] }],
  ayakkabi: [CINSIYET, { k: "numara", l: "Numara", t: "num" }],
  saat: [CINSIYET, { k: "tip", l: "Tip", t: "sel", o: ["Kol saati", "Akıllı saat", F] }],
  canta: [CINSIYET],
  bisiklet: [{ k: "tip", l: "Tip", t: "sel", o: ["Dağ", "Yol", "Şehir", "Elektrikli", "Çocuk", F] }, { k: "jant", l: "Jant", t: "sel", o: ["20", "24", "26", "27.5", "29", F] }],
  mobilya: [{ k: "tip", l: "Ne lazım", t: "sel", o: ["Koltuk takımı", "Yatak & Baza", "Yemek masası", "Gardırop", "Ofis mobilyası", F] }],
  beyaz: [{ k: "tip", l: "Ürün", t: "sel", o: ["Buzdolabı", "Çamaşır makinesi", "Bulaşık makinesi", "Fırın", "Kurutma makinesi", F] }, GARANTI],
  ismakine: [{ k: "tip", l: "Makine", t: "sel", o: ["Ekskavatör", "Kazıcı yükleyici", "Forklift", "Vinç", "Silindir", F] }, { k: "yil", l: "Model yılı (en eski)", t: "num" }],
  tarim: [{ k: "tip", l: "Makine", t: "sel", o: ["Traktör", "Biçerdöver", "Römork", "Pulluk", "İlaçlama makinesi", F] }, { k: "yil", l: "Model yılı (en eski)", t: "num" }],
  deniz: [{ k: "tip", l: "Tip", t: "sel", o: ["Yat", "Tekne", "Sürat teknesi", "Yelkenli", "Jet Ski", "Şişme bot", F] }, { k: "boy", l: "Boy (en az, metre)", t: "num" }, { k: "yil", l: "Model yılı (en eski)", t: "num" }],
};
// Satıcı tarafı (alarm ve talep listesindeki "elimdeki ürün" süzgeci): sayı alanına satıcı kendi ürününün değerini yazar,
// sunucu alıcının istediğiyle karşılaştırır (api/modules/requests.ts → NUM_MATCH ile aynı anahtarlar).
export const NUM_SHORT: Record<string, string> = { m2: "m²", bina_yasi: "Bina yaşı", kisi: "Kişi", boy: "Boy (m)", yil: "Model yılı", numara: "Numara" };
export function sellerNum(k: string, sub?: string): { l: string; h: string } | null {
  switch (k) {
    case "m2": return { l: sub === "arsa" ? "Arsanızın m²'si" : sub === "isyeri" ? "İşyerinizin m²'si" : sub === "satilik" || sub === "kiralik" ? "Evinizin m²'si" : "Gayrimenkulünüzün m²'si",
      h: "Örn. 600 yazarsanız \"en az 500 m²\" isteyen alıcılar gelir, \"en az 1000 m²\" isteyenler gelmez." };
    case "bina_yasi": return { l: "Binanızın yaşı", h: "Örn. 8 yazarsanız \"en fazla 10 yaşında\" isteyenler gelir, \"en fazla 5 yaşında\" isteyenler gelmez." };
    case "kisi": return { l: "Kaç kişilik", h: "Örn. 6 yazarsanız 6 kişiye kadar konaklama arayanlar gelir." };
    case "boy": return { l: "Teknenizin boyu (metre)", h: "Örn. 12 yazarsanız \"en az 10 metre\" isteyenler gelir, \"en az 15 metre\" isteyenler gelmez." };
    case "yil": return { l: sub === "deniz" ? "Teknenizin model yılı" : "Makinenizin model yılı", h: "Örn. 2019 yazarsanız \"2015 ve sonrası\" isteyenler gelir, \"2021 ve sonrası\" isteyenler gelmez." };
    case "numara": return { l: "Ayakkabı numarası", h: "Yalnızca bu numarayı isteyen alıcılar gelir." };
    default: return null;
  }
}

export const attrsFor = (top: string | undefined, sub: string | undefined): Attr[] => (sub && SUB_ATTRS[sub]) || (top && ATTRS[top]) || [];

export const CONDS = ["Sıfır", "İkinci El", "Farketmez", "Hizmet"];
// Kategoriye göre anlamlı ürün durumları: hizmet ve ders taleplerinde "Hizmet", emlakta seçim yok.
export const SERVICE_TOPS = ["hizmet", "ders"];
export function condsFor(top: string | undefined): string[] {
  if (!top) return ["Sıfır", "İkinci El", "Farketmez"];
  if (SERVICE_TOPS.includes(top)) return ["Hizmet"];
  if (top === "emlak") return ["Farketmez"];
  return ["Sıfır", "İkinci El", "Farketmez"];
}

export const THEME: Record<string, { c: string; fc: string }> = {
  vasita: { c: "#E8EDFA", fc: "#1C3178" }, emlak: { c: "#E6F4EC", fc: "#18794E" }, elektronik: { c: "#EEE9FB", fc: "#5A3DB8" },
  ev: { c: "#FDF0E3", fc: "#A55A12" }, yedek: { c: "#EDEFF2", fc: "#454C57" }, hizmet: { c: "#FCEBEA", fc: "#B3261E" },
  ders: { c: "#E5F3F7", fc: "#0F6B85" }, sanayi: { c: "#FFF4D9", fc: "#8A5A00" }, moda: { c: "#FBE9F1", fc: "#A3235F" },
  bebek: { c: "#FDECEE", fc: "#B23A4B" }, spor: { c: "#E7F6EF", fc: "#1D7A55" }, toptan: { c: "#F0ECE6", fc: "#6B4F2A" },
};
export const theme = (top: string) => THEME[top] ?? { c: "#EDEFF2", fc: "#454C57" };

export const DELIVERY: Record<string, string[]> = {
  vasita: ["Galeride görüntüleme", "Yerinde gösterim", "Noterde devir"],
  emlak: ["Hemen boş", "Ay başında boş", "Hafta sonu gösterim"],
  hizmet: ["Keşif yarın", "Bu hafta başlanır", "Tarih anlaşmalı"],
  ders: ["Online", "Yüz yüze", "Online / yüz yüze"],
  def: ["Ertesi gün kargo", "Aynı gün kurye", "Elden teslim", "Mağazadan teslim"],
};

export const CITIES = ["Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Aksaray", "Amasya", "Ankara", "Antalya", "Ardahan", "Artvin", "Aydın", "Balıkesir", "Bartın", "Batman", "Bayburt", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Düzce", "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkari", "Hatay", "Iğdır", "Isparta", "İstanbul", "İzmir", "Kahramanmaraş", "Karabük", "Karaman", "Kars", "Kastamonu", "Kayseri", "Kilis", "Kırıkkale", "Kırklareli", "Kırşehir", "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Mardin", "Mersin", "Muğla", "Muş", "Nevşehir", "Niğde", "Ordu", "Osmaniye", "Rize", "Sakarya", "Samsun", "Şanlıurfa", "Siirt", "Sinop", "Şırnak", "Sivas", "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Uşak", "Van", "Yalova", "Yozgat", "Zonguldak"];

// "Farketmez" seçilen alanlar listede ve talep sayfasında yazılmaz; yalnız alıcının kesin istediği bilgiler görünür.
export const isAny = (v: unknown) => v === undefined || v === null || v === "" || (typeof v === "string" && /^farketmez$/i.test(v.trim()));

export function attrLine(top: string, condition: string, attrs: Record<string, unknown>, sub?: string): string {
  const cond = isAny(condition) ? "" : condition;
  // Araç taleplerinde ayrıntılı özet (birden fazla marka/model, aralıklar).
  if (Array.isArray(attrs.araclar) || "yil_min" in attrs || "km_max" in attrs || "yakit" in attrs) return [cond, vehicleLine(attrs as VehicleAttrs)].filter(Boolean).join(" · ");
  const parts = cond ? [cond] : [];
  for (const a of attrsFor(top, sub)) {
    const v = attrs[a.k];
    if (isAny(v)) continue;
    parts.push(a.k === "yil" ? `${v} ve üstü` : a.k === "boy" ? `en az ${v} m` : a.k === "bina_yasi" ? `en fazla ${v} yaşında` : a.k === "kisi" ? `${v} kişilik` : a.k === "numara" ? `${v} numara` : a.k === "km" ? `en fazla ${Number(v).toLocaleString("tr-TR")} km` : a.k === "m2" ? `en az ${v} m²` : String(v));
  }
  return parts.join(" · ");
}
