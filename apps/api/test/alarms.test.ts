import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createRequest, login, makeApp, resetData, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
beforeEach(async () => {
  ctx ??= await makeApp();
  await resetData(ctx.pool);
});
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });

const alarm = (cookie: string, payload: Record<string, unknown>) => ctx.app.inject({ method: "POST", url: "/api/me/alarms", headers: { cookie }, payload });
const notified = async (phone: string) => (await ctx.pool.query(
  "SELECT n.text FROM notifications n JOIN users u ON u.id = n.user_id WHERE u.phone LIKE '%' || $1 ORDER BY n.id", [phone])).rows.map((r) => r.text);

describe("ayrıntılı talep alarmı", () => {
  it("arsa alarmı: il/ilçe, imar ve bütçe aralığına uyan talep haber verilir, uymayan verilmez", async () => {
    const seller = await login(ctx, "05331110001");
    const buyer = await login(ctx, "05321110001");
    const r = await alarm(seller, { category_id: "arsa", filters: { city: "İzmir", district: "urla", a_imar: "Konut", bmin: "1000000", bmax: "5000000", q: "deniz" } });
    expect(r.statusCode, r.body).toBe(201);
    const list = (await ctx.app.inject({ url: "/api/me/alarms", headers: { cookie: seller } })).json().items;
    expect(list[0]).toMatchObject({ category_id: "arsa", filters: { city: "İzmir", district: "Urla", a_imar: "Konut", bmin: "1000000", bmax: "5000000", q: "deniz" } });

    const base = { category_id: "arsa", condition: "Farketmez", city: "İzmir", district: "Urla", budget_min: 2000000, budget_max: 3000000, description: "Denize yakın olsun" };
    await createRequest(ctx, buyer, { ...base, title: "Urla'da konut imarlı arsa", attrs: { imar: "Konut", m2: 500 } });
    await createRequest(ctx, buyer, { ...base, title: "Urla'da tarla", attrs: { imar: "Tarla" } });
    await createRequest(ctx, buyer, { ...base, title: "Çeşme'de arsa", district: "Çeşme", attrs: { imar: "Konut" } });
    await createRequest(ctx, buyer, { ...base, title: "Pahalı arsa", budget_min: 9000000, budget_max: 12000000, attrs: { imar: "Konut" } });
    // İmar "Farketmez" diyen ve ilçe seçmeyen alıcı da uyar.
    await createRequest(ctx, buyer, { ...base, title: "İzmir'de herhangi bir arsa", district: "", attrs: { imar: "Farketmez" } });
    // Bildirim arka planda gider; gelene kadar beklenir.
    await expect.poll(() => notified("5331110001")).toEqual(['Alarmınıza uyan yeni talep: "Urla\'da konut imarlı arsa"', 'Alarmınıza uyan yeni talep: "İzmir\'de herhangi bir arsa"']);

    const matches = (await ctx.app.inject({ url: "/api/me/matches", headers: { cookie: seller } })).json().items.map((x: { title: string }) => x.title).sort();
    expect(matches).toEqual(["Urla'da konut imarlı arsa", "İzmir'de herhangi bir arsa"].sort());
  });

  it("araç alarmı: marka/model ve yakıt; eski biçim (il + en az bütçe) de çalışır; geçersiz ilçe reddedilir", async () => {
    const seller = await login(ctx, "05331110002");
    const buyer = await login(ctx, "05321110002");
    expect((await alarm(seller, { category_id: "otomobil", filters: { arac_marka: "BMW", arac_model: "3 Serisi" } })).statusCode).toBe(201);
    // Üst kategori (Vasıta tümü) + marka/model: yalnızca o aracı isteyen talepler.
    const other = await login(ctx, "05331110003");
    expect((await alarm(other, { category_id: "vasita", filters: { arac_marka: "BMW", arac_model: "1 Serisi" } })).statusCode).toBe(201);
    expect((await alarm(seller, { category_id: "elektronik", city: "Ankara", min_budget: 10000 })).statusCode).toBe(201);
    expect((await alarm(seller, { category_id: "arsa", filters: { city: "İzmir", district: "Olmayanilçe" } })).statusCode).toBe(400);
    expect((await alarm(seller, { category_id: "arsa", filters: { bmin: "5", bmax: "1" } })).statusCode).toBe(400);

    const car = { category_id: "otomobil", condition: "İkinci El", city: "İstanbul", district: "", budget_min: 1000000, budget_max: 1500000 };
    await createRequest(ctx, buyer, { ...car, title: "BMW 3 serisi arıyorum", attrs: { araclar: [{ marka: "BMW", model: "3 Serisi" }] } });
    await createRequest(ctx, buyer, { ...car, title: "Audi A4 arıyorum", attrs: { araclar: [{ marka: "Audi", model: "A4" }] } });
    await createRequest(ctx, buyer, { category_id: "telefon", condition: "İkinci El", city: "Ankara", district: "", budget_min: 15000, budget_max: 20000, title: "iPhone arıyorum", attrs: {} });
    await createRequest(ctx, buyer, { category_id: "telefon", condition: "İkinci El", city: "İzmir", district: "", budget_min: 15000, budget_max: 20000, title: "İzmir'de iPhone", attrs: {} });
    await createRequest(ctx, buyer, { ...car, category_id: "suv", title: "BMW 1 serisi arıyorum", attrs: { araclar: [{ marka: "BMW", model: "1 Serisi" }] } });
    await expect.poll(() => notified("5331110003")).toEqual(['Alarmınıza uyan yeni talep: "BMW 1 serisi arıyorum"']);
    await expect.poll(() => notified("5331110002")).toEqual(['Alarmınıza uyan yeni talep: "BMW 3 serisi arıyorum"', 'Alarmınıza uyan yeni talep: "iPhone arıyorum"']);
  });

  it("tek alarmla birden fazla araç ve il: araçlardan birine ve illerden birine uyan talep haber verilir; yakıt çoklu seçilir", async () => {
    const seller = await login(ctx, "05331110004");
    const buyer = await login(ctx, "05321110004");
    const r = await alarm(seller, { category_id: "vasita", filters: { araclar: "bmw:3 serisi,Audi:,Fiat:Egea", city: "İstanbul,Ankara", district: "Kadıköy", arac_yakit: "Dizel,Hibrit" } });
    expect(r.statusCode, r.body).toBe(201);
    const saved = (await ctx.app.inject({ url: "/api/me/alarms", headers: { cookie: seller } })).json().items[0].filters;
    // Yazım düzeltilir; birden fazla il seçilince ilçe sorulmaz.
    expect(saved).toEqual({ araclar: "BMW:3 Serisi,Audi:,Fiat:Egea", city: "İstanbul,Ankara", arac_yakit: "Dizel,Hibrit" });
    expect((await alarm(seller, { category_id: "vasita", filters: { city: "İstanbul,Atlantis" } })).statusCode).toBe(400);
    expect((await alarm(seller, { category_id: "vasita", filters: { arac_yakit: "Dizel,Kömür" } })).statusCode).toBe(400);

    const car = { category_id: "otomobil", condition: "İkinci El", city: "İstanbul", district: "", budget_min: 1000000, budget_max: 1500000 };
    await createRequest(ctx, buyer, { ...car, title: "BMW 3 serisi dizel arıyorum", attrs: { araclar: [{ marka: "BMW", model: "3 Serisi" }], yakit: ["Dizel"] } });
    await createRequest(ctx, buyer, { ...car, city: "Ankara", title: "Audi A6 Ankara'da arıyorum", attrs: { araclar: [{ marka: "Audi", model: "A6" }] } });
    await createRequest(ctx, buyer, { ...car, title: "Benzinli Egea arıyorum", attrs: { araclar: [{ marka: "Fiat", model: "Egea" }], yakit: ["Benzin"] } });
    await createRequest(ctx, buyer, { ...car, city: "İzmir", title: "İzmir'de BMW 3 serisi", attrs: { araclar: [{ marka: "BMW", model: "3 Serisi" }] } });
    await createRequest(ctx, buyer, { ...car, title: "Toyota Corolla arıyorum", attrs: { araclar: [{ marka: "Toyota", model: "Corolla" }] } });
    await expect.poll(() => notified("5331110004")).toEqual(['Alarmınıza uyan yeni talep: "BMW 3 serisi dizel arıyorum"', 'Alarmınıza uyan yeni talep: "Audi A6 Ankara\'da arıyorum"']);
  });

  it("sayı alanları: satıcının m²'si, bina yaşı, kişi sayısı, boy, yıl ve numara alıcının istediğiyle karşılaştırılır", async () => {
    const seller = await login(ctx, "05331110004");
    const buyer = await login(ctx, "05321110004");
    // Bu testte çok talep açılır; kişi başı açık talep sınırı kaldırılır.
    await ctx.pool.query("UPDATE settings SET value = '0' WHERE key = 'max_active_requests_per_user'");
    const base = { condition: "Farketmez", city: "İzmir", district: "", budget_min: 1000000, budget_max: 2000000 };
    const ids: Record<string, number> = {};
    ids.arsa500 = await createRequest(ctx, buyer, { ...base, category_id: "arsa", title: "En az 500 m2 arsa", attrs: { m2: 500 } });
    ids.arsa1000 = await createRequest(ctx, buyer, { ...base, category_id: "arsa", title: "En az 1000 m2 arsa", attrs: { m2: 1000 } });
    ids.arsaAny = await createRequest(ctx, buyer, { ...base, category_id: "arsa", title: "m2 farketmez arsa", attrs: {} });
    ids.ev5 = await createRequest(ctx, buyer, { ...base, category_id: "satilik", title: "En fazla 5 yaşında ev", attrs: { bina_yasi: 5 } });
    ids.ev20 = await createRequest(ctx, buyer, { ...base, category_id: "satilik", title: "En fazla 20 yaşında ev", attrs: { bina_yasi: 20 } });
    ids.gunluk8 = await createRequest(ctx, buyer, { ...base, category_id: "gunluk", title: "8 kişilik yazlık", attrs: { kisi: 8 } });
    ids.tekne = await createRequest(ctx, buyer, { ...base, category_id: "deniz", condition: "İkinci El", title: "En az 10 metre tekne", attrs: { tip: "Tekne", boy: 10, yil: 2015 } });
    ids.ayk42 = await createRequest(ctx, buyer, { ...base, category_id: "ayakkabi", condition: "Sıfır", budget_min: 1000, budget_max: 3000, title: "42 numara ayakkabı", attrs: { numara: 42 } });
    const list = async (qs: string) => (await ctx.app.inject({ url: `/api/requests?${qs}` })).json().items.map((x: { id: number }) => x.id).sort();
    expect(await list("sub=arsa&n_m2=600")).toEqual([ids.arsa500, ids.arsaAny].sort());
    expect(await list("sub=satilik&n_bina_yasi=10")).toEqual([ids.ev20]);
    expect(await list("sub=gunluk&n_kisi=6")).toEqual([]);
    expect(await list("sub=gunluk&n_kisi=10")).toEqual([ids.gunluk8]);
    expect(await list("sub=deniz&n_boy=12&n_yil=2018")).toEqual([ids.tekne]);
    expect(await list("sub=deniz&n_boy=8")).toEqual([]);
    expect(await list("sub=ayakkabi&n_numara=42")).toEqual([ids.ayk42]);
    expect(await list("sub=ayakkabi&n_numara=41")).toEqual([]);
    expect((await ctx.app.inject({ url: "/api/requests?sub=arsa&n_m2=abc" })).statusCode).toBe(400);

    // Alarmda da aynı kural: 600 m² arsası olan satıcıya yalnızca uyan yeni talep haber verilir.
    expect((await alarm(seller, { category_id: "arsa", filters: { n_m2: "600", n_bilinmeyen: "5" } })).statusCode).toBe(201);
    expect((await ctx.app.inject({ url: "/api/me/alarms", headers: { cookie: seller } })).json().items[0].filters).toEqual({ n_m2: "600" });
    expect((await alarm(seller, { category_id: "arsa", filters: { n_m2: "çok" } })).statusCode).toBe(400);
    await createRequest(ctx, buyer, { ...base, category_id: "arsa", title: "Yeni: en az 400 m2", attrs: { m2: 400 } });
    await createRequest(ctx, buyer, { ...base, category_id: "arsa", title: "Yeni: en az 2000 m2", attrs: { m2: 2000 } });
    await expect.poll(() => notified("5331110004")).toEqual(['Alarmınıza uyan yeni talep: "Yeni: en az 400 m2"']);
  });
});
