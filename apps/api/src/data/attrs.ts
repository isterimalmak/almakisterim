import { PRODUCT_MODELS } from "./products.js";
// Kategoriye özel talep özellikleri (oda sayısı, imar, hafıza…). Yapay zekâ talep metnini bu alanlara doldurur.
// apps/web/lib/catalog.ts ile birebir aynı olmalı; test/attrs.test.ts bunu denetler.
export type Attr = { k: string; l: string; t: "sel" | "num"; o?: string[]; by?: string; om?: Record<string, string[]> };

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
// Markaya bağlı model alanı: seçenekler seçilen markanın modelleri (om), o ise hepsi (doğrulama ve süzgeç için).
const modelOf = (sub: string): Attr => ({ k: "model", l: "Model", t: "sel", by: "marka", om: PRODUCT_MODELS[sub], o: [...Object.values(PRODUCT_MODELS[sub]!).flat(), F] });

// Alt kategoriye özel özellikler: arsada oda sayısı, televizyonda hafıza gibi alakasız alanlar çıkmaz.
// Burada olmayan alt kategoride üst kategorinin (ATTRS) alanları kullanılır.
export const SUB_ATTRS: Record<string, Attr[]> = {
  satilik: [ODA, M2, { k: "bina_yasi", l: "Bina yaşı (en fazla)", t: "num" }, ISITMA],
  kiralik: [ODA, M2, { k: "esya", l: "Eşya durumu", t: "sel", o: ["Eşyalı", "Eşyasız", F] }, ISITMA],
  gunluk: [ODA, { k: "kisi", l: "Kişi sayısı", t: "num" }],
  arsa: [M2, { k: "imar", l: "İmar durumu", t: "sel", o: ["Konut", "Ticari", "Tarla", "Bağ & Bahçe", "Sanayi", "Turizm", F] }, { k: "tapu", l: "Tapu durumu", t: "sel", o: ["Müstakil tapu", "Hisseli tapu", F] }],
  isyeri: [{ k: "tip", l: "İşyeri tipi", t: "sel", o: ["Dükkan & Mağaza", "Ofis", "Depo", "Fabrika & Atölye", "Plaza katı", F] }, M2],
  telefon: [{ k: "marka", l: "Marka", t: "sel", o: ["Apple", "Samsung", "Xiaomi", "Huawei", "Oppo", "Realme", F] }, modelOf("telefon"), HAFIZA, GARANTI],
  bilgisayar: [{ k: "tip", l: "Tip", t: "sel", o: ["Dizüstü", "Masaüstü", "Hepsi bir arada", F] }, { k: "marka", l: "Marka", t: "sel", o: ["Apple", "Lenovo", "Asus", "HP", "Dell", "Acer", "MSI", "Monster", F] }, modelOf("bilgisayar"),
    { k: "ram", l: "RAM", t: "sel", o: ["8 GB", "16 GB", "32 GB ve üzeri", F] }, GARANTI],
  tablet: [{ k: "marka", l: "Marka", t: "sel", o: ["Apple", "Samsung", "Xiaomi", "Lenovo", "Huawei", F] }, modelOf("tablet"), HAFIZA, GARANTI],
  tv: [{ k: "ekran", l: "Ekran boyutu", t: "sel", o: ["32-43 inç", "50-55 inç", "65 inç ve üzeri", F] }, { k: "marka", l: "Marka", t: "sel", o: ["Samsung", "LG", "Sony", "Philips", "TCL", "Vestel", F] }, GARANTI],
  kamera: [{ k: "tip", l: "Tip", t: "sel", o: ["Fotoğraf makinesi", "Aksiyon kamerası", "Video kamera", "Lens", F] }, { k: "marka", l: "Marka", t: "sel", o: ["Canon", "Nikon", "Sony", "Fujifilm", "GoPro", F] }],
  oyun: [{ k: "model", l: "Konsol", t: "sel", o: ["PlayStation 5 Pro", "PlayStation 5", "PlayStation 4", "Xbox One", "Xbox Series X/S", "Nintendo Switch 2", "Nintendo Switch OLED", "Nintendo Switch", F] }],
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
export const attrsFor = (top: string | undefined, sub: string | undefined): Attr[] => (sub && SUB_ATTRS[sub]) || (top && ATTRS[top]) || [];
