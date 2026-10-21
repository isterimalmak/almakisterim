import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ATTRS, SUB_ATTRS } from "../src/data/attrs.js";
import { ClaudeAi, HeuristicAi, type AiService, type Draft } from "../src/services/ai.js";
import { buildTitle, buyerTitle, fillAttrs, locative } from "../src/services/draft-fill.js";
import { findNeighbourhoodInText } from "../src/data/locations.js";
import { detectCategory } from "../src/services/category-detect.js";
import { login, makeApp, resetData, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
// Önceki test dosyalarından kalan giriş kodları (dakikada bir kod sınırı) bu dosyadaki yönetici girişini engellemesin.
beforeAll(async () => { ctx = await makeApp(); await resetData(ctx.pool); });
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });
const draft = async (c: TestCtx, text: string) => {
  const r = await c.app.inject({ method: "POST", url: "/api/ai/draft", payload: { text } });
  expect(r.statusCode, r.body).toBe(200);
  return r.json().draft;
};

describe("yapay zekâ talebi eksiksiz doldurur", () => {
  it("sitedeki ve sunucudaki kategori alanları aynı", async () => {
    // Sitenin dosyası tür denetimine girmesin diye yol değişkenden okunur.
    const webCatalog = new URL("../../web/lib/catalog.ts", import.meta.url).href;
    const web = await import(webCatalog) as { ATTRS: unknown; SUB_ATTRS: unknown };
    expect(SUB_ATTRS).toEqual(web.SUB_ATTRS);
    expect(ATTRS).toEqual(web.ATTRS);
  });

  it("kiralık daire: kategori, il/ilçe/mahalle, oda, m², eşya, ısıtma ve bütçe metinden doldurulur", async () => {
    const d = await draft(ctx, "Caddebostan'da 3+1 eşyalı kiralık daire arıyorum, en az 120 m2, kombili olsun, aylık 40 bin TL'ye kadar");
    expect(d).toMatchObject({ category_id: "kiralik", city: "İstanbul", district: "Kadıköy", neighbourhood: "Caddebostan", budget_max: 40000 });
    expect(d.attrs).toEqual({ oda: "3+1", m2: 120, esya: "Eşyalı", isitma: "Kombi" });
    expect(d.description).toContain("Caddebostan");
    // Yapay zekâ yokken de başlık cümle kopyalanmadan kurulur.
    expect(d.title).toBe("Caddebostan'da Aylık 40 Bin TL Bütçeli Eşyalı 3+1 Daire Kiralama Talebi");
  });

  it("arsa: imar, tapu ve m²; il yazılmasa da ilçeden bulunur", async () => {
    const d = await draft(ctx, "Urla'da 500 metrekare konut imarlı müstakil tapulu arsa, bütçem 5 milyon TL");
    // Tek değer yazıldı: en az bütçe uydurulmaz.
    expect(d).toMatchObject({ category_id: "arsa", city: "İzmir", district: "Urla", budget_min: null, budget_max: 5000000 });
    expect(d.attrs).toEqual({ m2: 500, imar: "Konut", tapu: "Müstakil tapu" });
    expect(d.title).toBe("Urla'da 5 Milyon TL Bütçeli 500 m² Konut İmarlı Arsa Alım Talebi");
  });

  it("arazi: 'arazi' arsa sayılır; iki ilçe yazılınca eki alan seçilir; 'en fazla 500 m²' en az alanına yazılmaz", async () => {
    const d = await draft(ctx, "Bodrum Milas'ta köyiçi alanı içerisinde kalan en fazla 500 metre² olan en fazla 500.000 TL ödeyeceğim bir arazi arıyorum");
    expect(d).toMatchObject({ category_id: "arsa", city: "Muğla", district: "Milas", budget_max: 500000, budget_min: null, title: "Milas'ta 500 Bin TL Bütçeli Arsa Alım Talebi" });
    expect(d.attrs).toEqual({});
    expect(d.description).toContain("en fazla 500 metre²");
  });

  it("satılık ev: 5+1 → '4+1 ve üzeri', bina yaşı; yazılmayan alan doldurulmaz", async () => {
    const d = await draft(ctx, "Ankara Çankaya'da en fazla 10 yaşında 5+1 satılık daire, 9 milyon TL");
    expect(d).toMatchObject({ category_id: "satilik", city: "Ankara", district: "Çankaya" });
    expect(d.attrs).toEqual({ oda: "4+1 ve üzeri", bina_yasi: 10 });
  });

  it("yapay zekânın verdiği yanlış seçenek ve uydurma konum atılır; doğrusu metinden bulunur", async () => {
    const liar: AiService = Object.assign(new HeuristicAi(), {
      draftRequest: async (): Promise<Draft> => ({ category_id: "kiralik", title: "Kiralık daire", budget_min: null, budget_max: 30000, city: "Gotham",
        district: "kadıköy", neighbourhood: "Olmayan Mahalle", condition: "Farketmez", is_urgent: false,
        attrs: { oda: "üç artı bir", esya: "eşyasız", m2: "yüz metre", bilinmeyen: "x" }, description: "Kiralık daire arıyorum." }),
    });
    const c2 = await makeApp({ ai: liar });
    try {
      const d = await draft(c2, "Kadıköy Moda'da 2+1 kiralık daire, 30 bin TL");
      // "Moda" resmî mahalle listesinde yok; uydurma mahalle de kabul edilmez, boş kalır.
      expect(d).toMatchObject({ city: "İstanbul", district: "Kadıköy", neighbourhood: "" });
      expect(d.attrs).toEqual({ oda: "2+1", esya: "Eşyasız" });
      expect(d.description).toBe("Kiralık daire arıyorum.");
    } finally { await c2.app.close(); await c2.pool.end(); }
  });

  it("bütçe aralığı yazılınca en az ve en fazla bütçe dolar", async () => {
    expect(await draft(ctx, "BMW 3 serisi, 1 ile 1,5 milyon arası, İstanbul")).toMatchObject({ budget_min: 1000000, budget_max: 1500000 });
    expect(await draft(ctx, "Kadıköy'de kiralık daire 30-40 bin TL")).toMatchObject({ budget_min: 30000, budget_max: 40000 });
  });

  it("yapay zekânın yazdığı başlık ve açıklama korunur; hata olursa kaydedilir ve yedek çalışır", async () => {
    const reply = { title: "Caddebostan'da Aylık 40 Bin TL Bütçeli Eşyalı 3+1 Kiralama Talebi", description: "Caddebostan'da eşyalı, kombili 3+1 bir daire arıyorum.",
      category_id: "kiralik", budget_min: null, budget_max: 40000, city: "İstanbul", district: "Kadıköy", neighbourhood: "Caddebostan",
      condition: "Farketmez" as const, is_urgent: false, ozellikler: [{ alan: "oda", deger: "3+1" }],
      attrs: { araclar: [], yil_min: null, yil_max: null, km_max: null, yakit: [], vites: [], kasa: [], hasarsiz: null } };
    const ai = new ClaudeAi("test-anahtari", "claude-opus-5-5");
    const calls: string[] = [];
    const fake = (impl: () => Promise<unknown>) => {
      (ai as unknown as { client: unknown }).client = {
        beta: { messages: { create: (p: { model: string }) => { calls.push(`beta:${p.model}`); return impl(); } } },
        messages: { create: (p: { model: string }) => { calls.push(p.model); return impl(); } },
      };
    };
    fake(async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(reply) }] }));
    const cats = [{ id: "kiralik", name: "Emlak › Konut (Kiralık)", parent: "emlak" }];
    expect(await ai.draftRequest("caddebostanda kiralık ev bakıyom", cats)).toMatchObject({ generated: true, title: reply.title, description: reply.description, attrs: { oda: "3+1" } });
    fake(async () => { throw Object.assign(new Error("invalid x-api-key"), { status: 401 }); });
    const d = await ai.draftRequest("caddebostanda kiralık ev bakıyom", cats);
    expect(d.generated).toBeUndefined();
    expect(ai.errors()[0]).toMatchObject({ where: "talep doldurma", message: "HTTP 401: invalid x-api-key" });
    // Anahtar hatasında başka yol denenmez.
    expect(calls).toEqual(["beta:claude-opus-5-5", "beta:claude-opus-5-5"]);
    fake(async () => ({ stop_reason: "max_tokens", content: [{ type: "text", text: "{\"tit" }] }));
    await ai.draftRequest("kiralık ev", cats);
    expect(ai.errors()[0]!.message).toContain("max_tokens");
    // Başka bir hata (ör. model bulunamadı) olursa betasız ve yedek modelle de denenir; biri çalışırsa sonuç gelir.
    calls.length = 0;
    let n = 0;
    fake(async () => { if (n++ < 2) throw Object.assign(new Error("model not found"), { status: 404 }); return { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(reply) }] }; });
    expect(await ai.draftRequest("caddebostanda kiralık ev", cats)).toMatchObject({ generated: true, title: reply.title });
    expect(calls).toEqual(["beta:claude-opus-5-5", "claude-opus-5-5", "claude-sonnet-5-5"]);
    // Yapay zekâ yazdıysa sunucu başlığı değiştirmez.
    const liar: AiService = Object.assign(new HeuristicAi(), { draftRequest: async (): Promise<Draft> => ({ ...reply, attrs: { oda: "3+1" }, generated: true }) });
    const c2 = await makeApp({ ai: liar });
    try {
      const r = await draft(c2, "caddebostanda kiralık ev bakıyom");
      expect(r).toMatchObject({ title: reply.title, description: reply.description });
      expect(r.generated).toBeUndefined();
    } finally { await c2.app.close(); await c2.pool.end(); }
  });

  it("panelde bağlantı denemesi: anahtar yoksa açıkça söyler", async () => {
    const admin = await login(ctx, "yonetici@almakisterim.com");
    const r = await ctx.app.inject({ method: "POST", url: "/api/admin/ai/test", headers: { cookie: admin }, payload: {} });
    expect(r.json()).toMatchObject({ ok: false, error: expect.stringContaining("anahtar") });
    expect((await ctx.app.inject({ url: "/api/admin/ai", headers: { cookie: admin } })).json().errors).toEqual([]);
  });

  it("yapay zekâ yokken de kategori mantığı: arsa, yat, kat, araç, ev eşyası birbirine karışmaz", () => {
    const all = new Set(["arsa", "satilik", "kiralik", "gunluk", "isyeri", "deniz", "otomobil", "suv", "ticari", "motosiklet", "mobilya", "nakliyat", "ayakkabi", "telefon", "beyaz"]);
    const c = (t: string, car = false) => detectCategory(t.toLocaleLowerCase("tr"), all, car);
    expect(c("Bodrum'da 12 metrelik yat arıyorum")).toBe("deniz");
    expect(c("Göcek'te yatı olan biri varsa satın alırım")).toBe("deniz");
    expect(c("yatak ve baza lazım")).toBe("mobilya");
    expect(c("Kadıköy'de 3. katta 2+1 daire")).toBe("satilik");
    expect(c("ara kat bir daire kiralamak istiyorum, kira 30 bin")).toBe("kiralik");
    expect(c("Bodrum'da haftalık kiralık yazlık")).toBe("gunluk");
    expect(c("kat karşılığı müteahhide verilecek arsa arıyorum")).toBe("arsa");
    expect(c("Milas'ta köy içi arazi")).toBe("arsa");
    expect(c("toyota hilux arazi aracı", true)).toBe("suv");
    expect(c("evden eve nakliyat lazım")).toBe("nakliyat");
    expect(c("42 numara bot ayakkabı")).toBe("ayakkabi");
    expect(c("merkezde kiralık dükkan")).toBe("isyeri");
    expect(c("ikinci el buzdolabı")).toBe("beyaz");
    expect(c("bir şey arıyorum")).toBeNull();
  });

  it("başlık her zaman alım talebi gibi okunur: 'Satılık' atılır, bütçe ve 'Alım/Kiralama Talebi' eklenir", () => {
    expect(buyerTitle("Beyazevler'de 2+1 Satılık Yatırımlık Daire", { sub: "satilik", budgetMax: 1_500_000 })).toBe("Beyazevler'de 1,5 Milyon TL Bütçeli 2+1 Yatırımlık Daire Alım Talebi");
    expect(buyerTitle("Kadıköy'de 3+1 Kiralık Daire", { sub: "kiralik", budgetMax: 35000 })).toBe("Kadıköy'de Aylık 35 Bin TL Bütçeli 3+1 Daire Kiralama Talebi");
    expect(buyerTitle("iPhone 15 Pro", { sub: "telefon", budgetMax: 850 })).toBe("850 TL Bütçeli iPhone 15 Pro Alım Talebi");
    expect(buyerTitle("Ev boya badana", { sub: "tadilat" })).toBe("Ev boya badana Talebi");
    // Zaten alım talebi olan başlık değişmez.
    expect(buyerTitle("Beyazevler'de 1,5 Milyon TL Bütçeli 2+1 Daire Alım Talebi", { sub: "satilik", budgetMax: 1_500_000 })).toBe("Beyazevler'de 1,5 Milyon TL Bütçeli 2+1 Daire Alım Talebi");
    expect(buyerTitle("Passat arıyorum", { sub: "otomobil" })).toBe("Passat arıyorum");
  });

  it("kurallı doldurucu ve mahalle bulucu", () => {
    expect(locative("Kadıköy")).toBe("Kadıköy'de");
    expect(locative("Urla")).toBe("Urla'da");
    expect(locative("Sinop")).toBe("Sinop'ta");
    expect(locative("Çeşme")).toBe("Çeşme'de");
    expect(buildTitle({ sub: "otomobil", subName: "Otomobil", attrs: { araclar: [{ marka: "Volkswagen", model: "Passat" }], yil_min: 2018, yakit: ["Dizel"] }, city: "İstanbul", district: "", neighbourhood: "" }))
      .toBe("2018 ve Sonrası Dizel Volkswagen Passat Alım Talebi");
    expect(fillAttrs("256 gb iphone 13 garantili", SUB_ATTRS.telefon!, {})).toEqual({ marka: "Apple", model: "iPhone 13", hafiza: "256 GB", garanti: "Var" });
    expect(fillAttrs("42 numara erkek ayakkabı", SUB_ATTRS.ayakkabi!, {})).toEqual({ cinsiyet: "Erkek", numara: 42 });
    expect(fillAttrs("12 metre 2015 model tekne", SUB_ATTRS.deniz!, {})).toEqual({ tip: "Tekne", boy: 12, yil: 2015 });
    expect(fillAttrs("dağ bisikleti 29 jant", SUB_ATTRS.bisiklet!, {})).toEqual({ tip: "Dağ", jant: "29" });
    expect(fillAttrs("araba arıyorum", SUB_ATTRS.arsa!, {})).toEqual({});
    expect(findNeighbourhoodInText("bostancıda ev", "İstanbul", "Kadıköy")).toEqual({ city: "İstanbul", district: "Kadıköy", neighbourhood: "Bostancı" });
    expect(findNeighbourhoodInText("merkez mahallesinde ev", "İstanbul", null)).toBeNull();
  });
});
