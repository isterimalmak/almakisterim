import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ATTRS, SUB_ATTRS } from "../src/data/attrs.js";
import { HeuristicAi, type AiService, type Draft } from "../src/services/ai.js";
import { fillAttrs } from "../src/services/draft-fill.js";
import { findNeighbourhoodInText } from "../src/data/locations.js";
import { makeApp, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
beforeAll(async () => { ctx = await makeApp(); });
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
  });

  it("arsa: imar, tapu ve m²; il yazılmasa da ilçeden bulunur", async () => {
    const d = await draft(ctx, "Urla'da 500 metrekare konut imarlı müstakil tapulu arsa, bütçem 5 milyon TL");
    // Tek değer yazıldı: en az bütçe uydurulmaz.
    expect(d).toMatchObject({ category_id: "arsa", city: "İzmir", district: "Urla", budget_min: null, budget_max: 5000000 });
    expect(d.attrs).toEqual({ m2: 500, imar: "Konut", tapu: "Müstakil tapu" });
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

  it("kurallı doldurucu ve mahalle bulucu", () => {
    expect(fillAttrs("256 gb iphone 13 garantili", SUB_ATTRS.telefon!, {})).toEqual({ marka: "Apple", hafiza: "256 GB", garanti: "Var" });
    expect(fillAttrs("42 numara erkek ayakkabı", SUB_ATTRS.ayakkabi!, {})).toEqual({ cinsiyet: "Erkek", numara: 42 });
    expect(fillAttrs("12 metre 2015 model tekne", SUB_ATTRS.deniz!, {})).toEqual({ tip: "Tekne", boy: 12, yil: 2015 });
    expect(fillAttrs("dağ bisikleti 29 jant", SUB_ATTRS.bisiklet!, {})).toEqual({ tip: "Dağ", jant: "29" });
    expect(fillAttrs("araba arıyorum", SUB_ATTRS.arsa!, {})).toEqual({});
    expect(findNeighbourhoodInText("bostancıda ev", "İstanbul", "Kadıköy")).toEqual({ city: "İstanbul", district: "Kadıköy", neighbourhood: "Bostancı" });
    expect(findNeighbourhoodInText("merkez mahallesinde ev", "İstanbul", null)).toBeNull();
  });
});
