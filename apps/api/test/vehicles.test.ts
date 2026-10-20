import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { parseVehicleText } from "../src/services/ai.js";
import { createRequest, login, makeApp, resetData, sampleRequest, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
beforeEach(async () => {
  ctx ??= await makeApp();
  await resetData(ctx.pool);
});
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });

const car = (attrs: Record<string, unknown>, over: Record<string, unknown> = {}) => ({
  ...sampleRequest, category_id: "otomobil", title: "İkinci el araç almak istiyorum", condition: "İkinci El",
  budget_min: 1_000_000, budget_max: 1_500_000, attrs, ...over,
});
const list = async (qs: string) => (await ctx.app.inject({ url: `/api/requests?${qs}` })).json().items.map((r: { title: string }) => r.title);

describe("araç talepleri", () => {
  it("birden fazla marka/model: adlar katalogdaki yazıma çevrilir, tekrarlar atılır, her araç ayrı talep olur", async () => {
    const u = await login(ctx, "05321112233");
    const id = await createRequest(ctx, u, car({
      araclar: [{ marka: "bmw", model: "3 serisi" }, { marka: "Audi", model: "A4" }, { marka: "BMW", model: "3 Serisi" }, { marka: "mercedes", model: null }],
      yil_min: 2018, yil_max: 2022, km_max: 100000, yakit: ["Dizel", "Hibrit"], vites: ["Otomatik"], hasarsiz: true,
    }));
    const rest = { yil_min: 2018, yil_max: 2022, km_max: 100000, yakit: ["Dizel", "Hibrit"], vites: ["Otomatik"], hasarsiz: true };
    expect((await ctx.app.inject({ url: `/api/requests/${id}` })).json().request.attrs).toEqual({ araclar: [{ marka: "BMW", model: "3 Serisi" }], ...rest });
    const all = (await ctx.pool.query("SELECT attrs FROM requests ORDER BY id")).rows.map((x) => x.attrs);
    expect(all).toEqual([{ marka: "BMW", model: "3 Serisi" }, { marka: "Audi", model: "A4" }, { marka: "Mercedes-Benz", model: null }].map((c) => ({ araclar: [c], ...rest })));
  });

  it("tanınmayan marka/model, ters yıl aralığı ve 5'ten fazla araç reddedilir", async () => {
    const u = await login(ctx, "05321112233");
    const post = (attrs: Record<string, unknown>) => ctx.app.inject({ method: "POST", url: "/api/requests", headers: { cookie: u }, payload: car(attrs) });
    expect((await post({ araclar: [{ marka: "Uydurma" }] })).json().error).toBe("marka_gecersiz");
    expect((await post({ araclar: [{ marka: "BMW", model: "A4" }] })).json().error).toBe("model_gecersiz");
    expect((await post({ yil_min: 2022, yil_max: 2018 })).json().error).toBe("yil_gecersiz");
    expect((await post({ yakit: ["Su"] })).statusCode).toBe(400);
    const six = Array.from({ length: 6 }, (_, i) => ({ marka: ["BMW", "Audi", "Fiat", "Ford", "Opel", "Kia"][i] }));
    expect((await post({ araclar: six })).statusCode).toBe(400);
  });

  it("satıcı elindeki araca uyan talepleri bulur", async () => {
    const u = await login(ctx, "05321112233");
    // Birden fazla araçlı talep araç başına bölünür; başlık her araca göre kurulduğundan testte tek araçla verilir.
    await createRequest(ctx, u, car({ araclar: [{ marka: "BMW", model: "3 Serisi" }], yil_min: 2018, km_max: 100000, yakit: ["Dizel"] }, { title: "A: BMW 3 veya A4 dizel" }));
    await createRequest(ctx, u, car({ araclar: [{ marka: "Audi", model: "A4" }], yil_min: 2018, km_max: 100000, yakit: ["Dizel"] }, { title: "A2: Audi A4 dizel" }));
    await createRequest(ctx, u, car({ araclar: [{ marka: "BMW", model: null }], yil_max: 2016 }, { title: "B: herhangi bir BMW, 2016 öncesi" }));
    await createRequest(ctx, u, car({ araclar: [{ marka: "Fiat", model: "Egea" }], vites: ["Manuel"] }, { title: "C: Egea manuel" }));
    await createRequest(ctx, u, car({}, { title: "D: marka farketmez" }));

    expect(await list("arac_marka=BMW")).toEqual(expect.arrayContaining(["A: BMW 3 veya A4 dizel", "B: herhangi bir BMW, 2016 öncesi"]));
    expect(await list("arac_marka=BMW")).toHaveLength(2);
    expect((await list("arac_marka=BMW&arac_model=5 Serisi")).sort()).toEqual(["B: herhangi bir BMW, 2016 öncesi"]);
    expect((await list("arac_marka=bmw&arac_model=3 serisi&arac_yil=2019&arac_km=80000&arac_yakit=Dizel")).sort()).toEqual(["A: BMW 3 veya A4 dizel"]);
    // A en fazla 100 bin km istiyor; km sınırı koymayan B uyar.
    expect(await list("arac_marka=BMW&arac_model=3 Serisi&arac_km=150000")).toEqual(["B: herhangi bir BMW, 2016 öncesi"]);
    expect((await list("arac_marka=Audi&arac_model=A4&arac_yakit=Benzin"))).toEqual([]);
    expect(await list("arac_marka=Audi&arac_model=A4&arac_yakit=Dizel")).toEqual(["A2: Audi A4 dizel"]);
    expect((await list("arac_yil=2015")).sort()).toEqual(["B: herhangi bir BMW, 2016 öncesi", "C: Egea manuel", "D: marka farketmez"]);
    expect((await list("arac_vites=Otomatik")).sort()).toEqual(["A2: Audi A4 dizel", "A: BMW 3 veya A4 dizel", "B: herhangi bir BMW, 2016 öncesi", "D: marka farketmez"]);
    // Satıcının birden fazla aracı: araçlardan birine uyan talepler; yakıt çoklu.
    expect((await list("araclar=Fiat:Egea,Audi:A4")).sort()).toEqual(["A2: Audi A4 dizel", "C: Egea manuel"]);
    expect((await list("arac_yakit=Benzin,Dizel")).length).toBe(5);
  });

  it("katalog uç noktası marka ve modelleri verir", async () => {
    const c = (await ctx.app.inject({ url: "/api/catalog/vehicles" })).json();
    expect(c.cars.BMW).toContain("3 Serisi");
    expect(c.subs.otomobil).toBe("car");
    expect(c.fuels).toContain("Dizel");
  });

  it("yapay zekâ taslağı (kural tabanlı) cümleden birden fazla araç ve ayrıntıları çıkarır", async () => {
    const r = await ctx.app.inject({ method: "POST", url: "/api/ai/draft", payload: { text: "BMW 3 serisi veya Audi A4 almak istiyorum, 2018 sonrası, en fazla 100 bin km, dizel otomatik, hasarsız olsun, bütçem 1,5 milyon TL, İstanbul" } });
    const d = r.json().draft;
    expect(d.category_id).toBe("otomobil");
    expect(d.budget_max).toBe(1_500_000);
    expect(d.attrs).toEqual({ araclar: [{ marka: "BMW", model: "3 Serisi" }, { marka: "Audi", model: "A4" }], yil_min: 2018, km_max: 100000, yakit: ["Dizel"], vites: ["Otomatik"], hasarsiz: true });
  });

  it("metin ayrıştırıcı: yıl aralığı, marka takma adları ve modelsiz marka", () => {
    const v = parseVehicleText("mercedes c serisi ya da vw golf, 2017-2020 arası, benzinli veya hibrit, yarı otomatik");
    expect(v.araclar).toEqual([{ marka: "Mercedes-Benz", model: "C Serisi" }, { marka: "Volkswagen", model: "Golf" }]);
    expect(v).toMatchObject({ yil_min: 2017, yil_max: 2020, yakit: ["Benzin", "Hibrit"], vites: ["Yarı Otomatik"] });
    expect(parseVehicleText("toyota bakıyorum").araclar).toEqual([{ marka: "Toyota", model: null }]);
  });
});

describe("araç kataloğu", () => {
  it("Türkiye'deki markaların tamamına yakını ve 'Diğer' seçeneği vardır", async () => {
    const c = (await ctx.app.inject({ url: "/api/catalog/vehicles" })).json();
    for (const b of ["Tofaş", "Lada", "Daewoo", "Ferrari", "Porsche", "Geely", "Chery", "Togg", "Smart", "Isuzu", "Diğer"]) expect(c.cars).toHaveProperty([b]);
    expect(Object.keys(c.cars).length).toBeGreaterThan(75);
    expect(c.cars["Tofaş"]).toContain("Şahin");
    expect(c.moto).toHaveProperty(["Diğer"]);
  });

  it("'Diğer' marka ve takma adlarla yazılan markalar kabul edilir", async () => {
    const u = await login(ctx, "05321112233");
    await createRequest(ctx, u, car({ araclar: [{ marka: "diğer", model: null }, { marka: "ssangyong", model: "Korando" }, { marka: "Haval", model: null }] }));
    const all = (await ctx.pool.query("SELECT attrs FROM requests ORDER BY id")).rows.flatMap((x) => x.attrs.araclar);
    expect(all).toEqual([{ marka: "Diğer", model: null }, { marka: "KGM / SsangYong", model: "Korando" }, { marka: "GWM / Haval", model: null }]);
  });

  it("metin ayrıştırıcı yeni markaları tanır, günlük sözcükleri marka saymaz", () => {
    expect(parseVehicleText("tofaş şahin veya lada niva arıyorum").araclar).toEqual([{ marka: "Tofaş", model: "Şahin" }, { marka: "Lada", model: "Niva" }]);
    expect(parseVehicleText("8 gb ram akıllı telefon, smart saat").araclar).toEqual([]);
  });
});
