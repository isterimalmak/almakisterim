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

export function attrLine(top: string, condition: string, attrs: Record<string, unknown>): string {
  // Araç taleplerinde ayrıntılı özet (birden fazla marka/model, aralıklar).
  if (Array.isArray(attrs.araclar) || "yil_min" in attrs || "km_max" in attrs || "yakit" in attrs) return `${condition} · ${vehicleLine(attrs as VehicleAttrs)}`;
  const parts = [condition];
  for (const a of ATTRS[top] ?? []) {
    const v = attrs[a.k];
    if (v === undefined || v === "") continue;
    parts.push(a.k === "yil" ? `${v} ve üstü` : a.k === "km" ? `en fazla ${Number(v).toLocaleString("tr-TR")} km` : a.k === "m2" ? `en az ${v} m²` : String(v));
  }
  return parts.join(" · ");
}
