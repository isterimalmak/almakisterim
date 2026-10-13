// Pixabay: ücretsiz kullanım izinli stok fotoğraflar (Pexels'in yerine; anahtar hemen verilir).
// Anahtar yalnızca sunucuda durur (Secret Manager → PIXABAY_API_KEY); tarayıcıya ve loga gitmez.
import { downloadImage, type PhotoSource, type StockPhoto } from "./pexels.js";

type Hit = { id: number; pageURL: string; tags: string; webformatURL: string; largeImageURL: string; user: string; user_id: number };

const HOSTS = ["pixabay.com", "cdn.pixabay.com"];
// Pixabay'in kendi kategorisi: alakasız sonuçları azaltır (araba aramasında tarla, arsa aramasında vinç çıkmasın).
const PB_CATEGORY: Record<string, string> = {
  otomobil: "transportation", suv: "transportation", elektrikli: "transportation", ticari: "transportation", motosiklet: "transportation", deniz: "transportation",
  otoparca: "transportation", lastik: "transportation", motoparca: "transportation", multimedya: "transportation",
  satilik: "buildings", kiralik: "buildings", gunluk: "buildings", isyeri: "buildings",
  telefon: "computer", bilgisayar: "computer", tablet: "computer", tv: "computer", kamera: "computer", oyun: "computer",
  giyim: "fashion", ayakkabi: "fashion", canta: "fashion", saat: "fashion",
  bisiklet: "sports", fitness: "sports", kamp: "sports", muzik: "music", muzikders: "music",
  sanayimak: "industry", ismakine: "industry", jenerator: "industry", yapi: "industry", gida: "food", otel: "food",
};
const toPhoto = (h: Hit): StockPhoto => ({ id: h.id, thumb: h.webformatURL, large: h.largeImageURL, alt: h.tags ?? "", photographer: h.user,
  photographer_url: `https://pixabay.com/users/${encodeURIComponent(h.user)}-${h.user_id}/`, page_url: h.pageURL });

export class Pixabay implements PhotoSource {
  readonly name = "Pixabay";
  readonly site = "https://pixabay.com";
  private cache = new Map<string, { at: number; items: StockPhoto[] }>();
  constructor(private key: string, private fetchFn: typeof fetch = fetch) {}
  get enabled() { return !!this.key; }

  private url(params: Record<string, string>) {
    return `https://pixabay.com/api/?${new URLSearchParams({ key: this.key, image_type: "photo", safesearch: "true", lang: "en", ...params })}`;
  }

  // Pixabay sonuçların önbellekte tutulmasını ister; görsel adresleri bir gün geçerli olduğu için 12 saat tutulur.
  async search(query: string, perPage = 12, sub?: string): Promise<StockPhoto[]> {
    if (!this.key) return [];
    const cat = (sub && PB_CATEGORY[sub]) || "";
    const ck = `${query}|${perPage}|${cat}`;
    const hit = this.cache.get(ck);
    if (hit && Date.now() - hit.at < 12 * 3600_000) return hit.items;
    const res = await this.fetchFn(this.url({ q: query.slice(0, 100), per_page: String(Math.min(200, Math.max(3, perPage))), orientation: "horizontal", ...(cat ? { category: cat } : {}) }), { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`Pixabay arama hata kodu ${res.status}`);
    const items = ((await res.json()) as { hits?: Hit[] }).hits?.slice(0, perPage).map(toPhoto) ?? [];
    this.cache.set(ck, { at: Date.now(), items });
    if (this.cache.size > 500) this.cache.delete(this.cache.keys().next().value!);
    return items;
  }

  async photo(id: number): Promise<StockPhoto | null> {
    if (!this.key) return null;
    const res = await this.fetchFn(this.url({ id: String(id) }), { signal: AbortSignal.timeout(4000) });
    // Olmayan fotoğrafta Pixabay 400 döner; anahtar hatası da 400 olduğu için metne bakılır.
    if (res.status === 400 && !/key/i.test(await res.text())) return null;
    if (!res.ok) throw new Error(`Pixabay hata kodu ${res.status}`);
    const h = ((await res.json()) as { hits?: Hit[] }).hits?.[0];
    return h ? toPhoto(h) : null;
  }

  download(photo: StockPhoto) { return downloadImage(this.fetchFn, photo.large, HOSTS); }
}
