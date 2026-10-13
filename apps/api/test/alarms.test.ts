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
    expect((await alarm(seller, { category_id: "elektronik", city: "Ankara", min_budget: 10000 })).statusCode).toBe(201);
    expect((await alarm(seller, { category_id: "arsa", filters: { city: "İzmir", district: "Olmayanilçe" } })).statusCode).toBe(400);
    expect((await alarm(seller, { category_id: "arsa", filters: { bmin: "5", bmax: "1" } })).statusCode).toBe(400);

    const car = { category_id: "otomobil", condition: "İkinci El", city: "İstanbul", district: "", budget_min: 1000000, budget_max: 1500000 };
    await createRequest(ctx, buyer, { ...car, title: "BMW 3 serisi arıyorum", attrs: { araclar: [{ marka: "BMW", model: "3 Serisi" }] } });
    await createRequest(ctx, buyer, { ...car, title: "Audi A4 arıyorum", attrs: { araclar: [{ marka: "Audi", model: "A4" }] } });
    await createRequest(ctx, buyer, { category_id: "telefon", condition: "İkinci El", city: "Ankara", district: "", budget_min: 15000, budget_max: 20000, title: "iPhone arıyorum", attrs: {} });
    await createRequest(ctx, buyer, { category_id: "telefon", condition: "İkinci El", city: "İzmir", district: "", budget_min: 15000, budget_max: 20000, title: "İzmir'de iPhone", attrs: {} });
    await expect.poll(() => notified("5331110002")).toEqual(['Alarmınıza uyan yeni talep: "BMW 3 serisi arıyorum"', 'Alarmınıza uyan yeni talep: "iPhone arıyorum"']);
  });
});
