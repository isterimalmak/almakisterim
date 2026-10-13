// Pexels: ücretsiz kullanım izinli stok fotoğraflar. Alıcının talebine uyan görseller aranır.
// Anahtar yalnızca sunucuda durur (Secret Manager → PEXELS_API_KEY); tarayıcıya gitmez.
export type StockPhoto = { id: number; thumb: string; large: string; alt: string; photographer: string; photographer_url: string; page_url: string };

// Ücretsiz fotoğraf kaynağı (Pexels veya Pixabay): ara, tek fotoğrafı getir, indir.
export interface PhotoSource {
  readonly name: string;
  readonly site: string;
  readonly enabled: boolean;
  search(query: string, perPage?: number, sub?: string): Promise<StockPhoto[]>;
  photo(id: number): Promise<StockPhoto | null>;
  download(photo: StockPhoto): Promise<{ body: Buffer; contentType: string }>;
}

// Seçilen fotoğraf indirilir (yalnızca kaynağın kendi görsel sunucusundan, en fazla 10 MB).
export async function downloadImage(fetchFn: typeof fetch, url: string, hosts: string[]): Promise<{ body: Buffer; contentType: string }> {
  const u = new URL(url);
  if (u.protocol !== "https:" || !hosts.includes(u.hostname)) throw new Error("Beklenmeyen görsel adresi");
  const res = await fetchFn(u, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Görsel indirilemedi (${res.status})`);
  const contentType = (res.headers.get("content-type") ?? "").split(";")[0]!;
  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) throw new Error("Görsel türü desteklenmiyor");
  const body = Buffer.from(await res.arrayBuffer());
  if (body.length > 10 * 1024 * 1024) throw new Error("Görsel çok büyük");
  return { body, contentType };
}
type Raw = { id: number; url: string; alt: string; photographer: string; photographer_url: string; src: { large: string; medium: string } };

const ALLOWED_HOST = "images.pexels.com";
const toPhoto = (p: Raw): StockPhoto => ({ id: p.id, thumb: p.src.medium, large: p.src.large, alt: p.alt ?? "", photographer: p.photographer, photographer_url: p.photographer_url, page_url: p.url });

// Kategori → İngilizce arama (Pexels İngilizce aramada en iyi sonucu verir).
const QUERIES: Record<string, string> = {
  otomobil: "car", suv: "suv car", motosiklet: "motorcycle", ticari: "van truck", elektrikli: "electric car",
  kiralik: "apartment interior", satilik: "apartment interior living room", isyeri: "shop office interior", arsa: "vacant land plot for sale", gunluk: "holiday apartment",
  deniz: "yacht boat",
  telefon: "smartphone", bilgisayar: "laptop", tablet: "tablet device", tv: "television living room", kamera: "camera", oyun: "game console",
  mobilya: "furniture", beyaz: "washing machine kitchen appliance", kucuk: "kitchen appliance", dekor: "home decor", bahce: "garden tools",
  otoparca: "car parts", lastik: "car tire wheel", motoparca: "motorcycle parts", multimedya: "car stereo",
  tadilat: "home renovation", nakliyat: "moving boxes truck", temizlik: "house cleaning", tesisat: "plumber electrician", organizasyon: "event photographer",
  lise: "student studying", dil: "language learning", muzikders: "music lesson", yazilim: "coding laptop",
  ismakine: "excavator", jenerator: "generator", tarim: "tractor", sanayimak: "industrial machine",
  ayakkabi: "shoes", giyim: "clothes", canta: "handbag", saat: "wrist watch",
  araba: "baby stroller", oto: "child car seat", oda: "nursery room", oyuncak: "toys",
  bisiklet: "bicycle", fitness: "fitness equipment", kamp: "camping tent", muzik: "musical instrument",
  gida: "food wholesale", ambalaj: "packaging boxes", tekstil: "fabric textile", otel: "restaurant kitchen equipment", yapi: "construction materials",
};

// "3 Serisi" → "3 Series", Mercedes "C Serisi" → "C-Class".
function modelEn(marka: string, model: string) {
  const m = /^([A-Z]) Serisi$/.exec(model);
  if (marka === "Mercedes-Benz" && m) return `${m[1]}-Class`;
  return model.replace(/Serisi/g, "Series");
}

// Formda seçilen tip (Yat, Dükkan, Traktör…) varsa arama ona göre yapılır.
const TIP_EN: Record<string, string> = {
  Yat: "luxury yacht", Tekne: "motor boat", "Sürat teknesi": "speedboat", Yelkenli: "sailboat", "Jet Ski": "jet ski", "Şişme bot": "inflatable boat",
  "Dükkan & Mağaza": "retail shop storefront", Ofis: "office interior", Depo: "warehouse", "Fabrika & Atölye": "factory workshop", "Plaza katı": "office building",
  Konut: "residential building plot", Ticari: "commercial land", Tarla: "farm field", "Bağ & Bahçe": "orchard garden", Sanayi: "industrial area", Turizm: "seaside land",
  Dizüstü: "laptop", Masaüstü: "desktop computer", "Hepsi bir arada": "all in one computer", "Fotoğraf makinesi": "dslr camera", "Aksiyon kamerası": "action camera", "Video kamera": "video camera", Lens: "camera lens",
  "PlayStation 5": "playstation 5", "PlayStation 4": "playstation 4", "Xbox Series X/S": "xbox controller", "Nintendo Switch": "nintendo switch",
  "Kol saati": "wrist watch", "Akıllı saat": "smartwatch", Dağ: "mountain bike", Yol: "road bike", Şehir: "city bike", Elektrikli: "electric bike", Çocuk: "kids bike",
  "Koltuk takımı": "sofa living room", "Yatak & Baza": "bed bedroom", "Yemek masası": "dining table", Gardırop: "wardrobe", "Ofis mobilyası": "office furniture",
  Buzdolabı: "refrigerator", "Çamaşır makinesi": "washing machine", "Bulaşık makinesi": "dishwasher", Fırın: "kitchen oven", "Kurutma makinesi": "tumble dryer",
  Ekskavatör: "excavator", "Kazıcı yükleyici": "backhoe loader", Forklift: "forklift", Vinç: "crane construction", Silindir: "road roller",
  Traktör: "tractor", Biçerdöver: "combine harvester", Römork: "farm trailer", Pulluk: "plough", "İlaçlama makinesi": "crop sprayer",
};

export function queriesFor(category: string, araclar: { marka: string; model: string }[], tip?: string) {
  const base = (tip && TIP_EN[tip]) || QUERIES[category] || "product";
  if (!araclar.length) return [base];
  const kind = category === "motosiklet" ? "motorcycle" : "car";
  return araclar.slice(0, 3).map((a) => (a.model ? `${a.marka} ${modelEn(a.marka, a.model)}` : `${a.marka} ${kind}`).replace(/\s+/g, " ").trim());
}

export class Pexels implements PhotoSource {
  readonly name = "Pexels";
  readonly site = "https://www.pexels.com";
  private cache = new Map<string, { at: number; items: StockPhoto[] }>();
  constructor(private key: string, private fetchFn: typeof fetch = fetch) {}
  get enabled() { return !!this.key; }

  // Sonuçlar 12 saat bellekte tutulur (Pexels saatlik sınırı aşılmasın).
  async search(query: string, perPage = 12, _sub?: string): Promise<StockPhoto[]> {
    if (!this.key) return [];
    const ck = `${query}|${perPage}`;
    const hit = this.cache.get(ck);
    if (hit && Date.now() - hit.at < 12 * 3600_000) return hit.items;
    const url = `https://api.pexels.com/v1/search?${new URLSearchParams({ query, per_page: String(Math.min(80, perPage)), orientation: "landscape" })}`;
    const res = await this.fetchFn(url, { headers: { Authorization: this.key }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`Pexels arama hata kodu ${res.status}`);
    const items = ((await res.json()) as { photos?: Raw[] }).photos?.map(toPhoto) ?? [];
    this.cache.set(ck, { at: Date.now(), items });
    if (this.cache.size > 500) this.cache.delete(this.cache.keys().next().value!);
    return items;
  }

  async photo(id: number): Promise<StockPhoto | null> {
    if (!this.key) return null;
    const res = await this.fetchFn(`https://api.pexels.com/v1/photos/${id}`, { headers: { Authorization: this.key }, signal: AbortSignal.timeout(4000) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Pexels hata kodu ${res.status}`);
    return toPhoto((await res.json()) as Raw);
  }

  download(photo: StockPhoto) { return downloadImage(this.fetchFn, photo.large, [ALLOWED_HOST]); }
}
