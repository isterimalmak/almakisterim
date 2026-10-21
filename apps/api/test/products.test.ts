import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SUB_ATTRS } from "../src/data/attrs.js";
import { fillAttrs } from "../src/services/draft-fill.js";
import { createRequest, login, makeApp, resetData, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
beforeAll(async () => { ctx = await makeApp(); await resetData(ctx.pool); });
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });

describe("ürün modelleri (marka → model)", () => {
  it("site, uygulama ve sunucudaki model listeleri aynı; her model kendi markasının seçeneklerinde", async () => {
    // Uygulamanın dosyaları içe aktarılmadan metin olarak karşılaştırılır (CI'da uygulama paketleri bu adımda kurulu değil).
    const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
    const own = read("../src/data/products.ts");
    for (const path of ["../../web/lib/products.ts", "../../mobile/src/lib/products.ts"]) expect(read(path)).toBe(own);
    // Kategori alanları: uygulamadaki ATTRS / SUB_ATTRS / modelOf bölümleri sitedekiyle (draft.test.ts sunucuyla karşılaştırır) aynı.
    const part = (src: string, from: string, to: string) => src.slice(src.indexOf(from), src.indexOf(to, src.indexOf(from)));
    const web = read("../../web/lib/catalog.ts"), mobile = read("../../mobile/src/lib/catalog.ts");
    for (const [from, to] of [["export const ATTRS", "\n};\n"], ["const modelOf", "\n"], ["export const SUB_ATTRS", "\n};\n"]] as const) {
      expect(part(web, from, to).length).toBeGreaterThan(10);
      expect(part(mobile, from, to)).toBe(part(web, from, to));
    }
    for (const sub of ["telefon", "tablet", "bilgisayar"]) {
      const marka = SUB_ATTRS[sub]!.find((a) => a.k === "marka")!.o!;
      const model = SUB_ATTRS[sub]!.find((a) => a.k === "model")!;
      expect(model.by).toBe("marka");
      for (const b of Object.keys(model.om!)) expect(marka).toContain(b);
      const all = Object.values(model.om!).flat();
      expect(new Set(all).size).toBe(all.length);
    }
  });

  it("metinden model bulunur, en uzun ad önce; marka modelden gelir", () => {
    const tel = SUB_ATTRS.telefon!;
    expect(fillAttrs("iphone 12 pro max arıyorum 256 gb", tel, {})).toMatchObject({ marka: "Apple", model: "iPhone 12 Pro Max", hafiza: "256 GB" });
    expect(fillAttrs("iphone 16 pro lazım", tel, {})).toMatchObject({ marka: "Apple", model: "iPhone 16 Pro" });
    expect(fillAttrs("iphone 16 olsun", tel, {})).toMatchObject({ model: "iPhone 16" });
    expect(fillAttrs("samsung s24 ultra", tel, {})).toMatchObject({ marka: "Samsung", model: "Galaxy S24 Ultra" });
    expect(fillAttrs("redmi note 13 pro+ arıyorum", tel, {})).toMatchObject({ marka: "Xiaomi", model: "Redmi Note 13 Pro+" });
    // Yapay zekânın markayla çelişen modeli bırakılır.
    expect(fillAttrs("telefon", tel, { marka: "Samsung", model: "iPhone 15" })).toEqual({ marka: "Samsung" });
    expect(fillAttrs("macbook air m2", SUB_ATTRS.bilgisayar!, {})).toMatchObject({ marka: "Apple", model: "MacBook Air (M2)" });
    expect(fillAttrs("ps5 pro arıyorum", SUB_ATTRS.oyun!, {})).toEqual({ model: "PlayStation 5 Pro" });
    expect(fillAttrs("ps5 arıyorum", SUB_ATTRS.oyun!, {})).toEqual({ model: "PlayStation 5" });
  });

  it("talep: model markaya uymalı; satıcı modele göre süzer", async () => {
    const buyer = await login(ctx, "05321119001");
    const bad = await ctx.app.inject({ method: "POST", url: "/api/requests", headers: { cookie: buyer },
      payload: { category_id: "telefon", title: "Telefon arıyorum", description: "Temiz olsun", budget_min: 30000, budget_max: 30000, city: "Ankara", district: "", condition: "Farketmez", attrs: { marka: "Samsung", model: "iPhone 16 Pro" }, contact_consent: true } });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error).toBe("model_gecersiz");

    const base = { category_id: "telefon", city: "Ankara", district: "", condition: "Farketmez", budget_min: 30000, budget_max: 30000 };
    const a = await createRequest(ctx, buyer, { ...base, title: "iPhone 16 Pro arıyorum", attrs: { model: "iPhone 16 Pro" } });
    await createRequest(ctx, buyer, { ...base, title: "iPhone 12 Pro Max arıyorum", attrs: { marka: "Apple", model: "iPhone 12 Pro Max" } });
    await createRequest(ctx, buyer, { ...base, title: "Herhangi bir iPhone", attrs: { marka: "Apple" } });
    // Marka boş gelse de modelden bulunur.
    expect((await ctx.app.inject({ url: `/api/requests/${a}` })).json().request.attrs).toMatchObject({ marka: "Apple", model: "iPhone 16 Pro" });

    const titles = async (q: string) => (await ctx.app.inject({ url: `/api/requests?sub=telefon&${q}` })).json().items.map((x: { title: string }) => x.title).sort();
    expect(await titles(`a_model=${encodeURIComponent("iPhone 16 Pro")}`)).toEqual(["Herhangi bir iPhone", "iPhone 16 Pro arıyorum"]);
    expect(await titles(`a_marka=Apple&a_model=${encodeURIComponent("iPhone 12 Pro Max,iPhone 16 Pro")}`)).toEqual(["Herhangi bir iPhone", "iPhone 12 Pro Max arıyorum", "iPhone 16 Pro arıyorum"]);
  });
});
