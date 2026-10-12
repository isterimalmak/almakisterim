import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createRequest, login, makeApp, resetData, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
beforeEach(async () => {
  ctx ??= await makeApp();
  await resetData(ctx.pool);
});
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });

const offer = (price: number, note = "Kutulu ve faturalı") => ({ price, condition: "İkinci el, çok iyi", delivery: "Ertesi gün kargo", warranty: true, note });

describe("teklifler", () => {
  it("satıcı teklif verir, alıcıya bildirim gider, fiyatı yalnızca alıcı görür", async () => {
    const buyer = await login(ctx, "05321112233", "Elif Sönmez");
    const seller = await login(ctx, "05321112244", "Ahmet Kaya");
    const other = await login(ctx, "05321112255", "Mehmet Demir");
    const id = await createRequest(ctx, buyer);

    const r = await ctx.app.inject({ method: "POST", url: `/api/requests/${id}/offers`, headers: { cookie: seller }, payload: offer(18500) });
    expect(r.statusCode).toBe(201);
    expect(r.json().charged_credit).toBe(false);
    expect(ctx.outbox.last("905321112233")?.text).toContain("yeni bir teklif");

    const asBuyer = (await ctx.app.inject({ url: `/api/requests/${id}`, headers: { cookie: buyer } })).json();
    expect(asBuyer.offers).toHaveLength(1);
    expect(asBuyer.offers[0]).toMatchObject({ price: 18500, seller_name: "Ahmet K." });

    const asSeller = (await ctx.app.inject({ url: `/api/requests/${id}`, headers: { cookie: seller } })).json();
    expect(asSeller.offers).toHaveLength(1);
    expect(asSeller.offers[0].mine).toBe(true);

    const asOther = (await ctx.app.inject({ url: `/api/requests/${id}`, headers: { cookie: other } })).json();
    expect(asOther.offers).toHaveLength(0);
    expect(asOther.request.offer_count).toBe(1);

    const anon = (await ctx.app.inject({ url: `/api/requests/${id}` })).json();
    expect(anon.offers).toHaveLength(0);
  });

  it("kendi talebine ve aynı talebe ikinci kez teklif verilemez", async () => {
    const buyer = await login(ctx, "05321112233");
    const seller = await login(ctx, "05321112244");
    const id = await createRequest(ctx, buyer);
    expect((await ctx.app.inject({ method: "POST", url: `/api/requests/${id}/offers`, headers: { cookie: buyer }, payload: offer(18000) })).statusCode).toBe(400);
    expect((await ctx.app.inject({ method: "POST", url: `/api/requests/${id}/offers`, headers: { cookie: seller }, payload: offer(18000) })).statusCode).toBe(201);
    expect((await ctx.app.inject({ method: "POST", url: `/api/requests/${id}/offers`, headers: { cookie: seller }, payload: offer(17000) })).statusCode).toBe(409);
  });

  it("aylık ücretsiz hak bitince kredi düşer, kredi yoksa 402 döner", async () => {
    await ctx.pool.query("UPDATE settings SET value = '1' WHERE key = 'free_offers_per_month'");
    const buyer = await login(ctx, "05321112233");
    const seller = await login(ctx, "05321112244");
    const ids = [await createRequest(ctx, buyer), await createRequest(ctx, buyer), await createRequest(ctx, buyer)];

    const first = await ctx.app.inject({ method: "POST", url: `/api/requests/${ids[0]}/offers`, headers: { cookie: seller }, payload: offer(18000) });
    expect(first.json().charged_credit).toBe(false);
    const noCredit = await ctx.app.inject({ method: "POST", url: `/api/requests/${ids[1]}/offers`, headers: { cookie: seller }, payload: offer(18000) });
    expect(noCredit.statusCode).toBe(402);

    await ctx.pool.query("UPDATE users SET credits = 1 WHERE phone = '905321112244'");
    const paid = await ctx.app.inject({ method: "POST", url: `/api/requests/${ids[1]}/offers`, headers: { cookie: seller }, payload: offer(18000) });
    expect(paid.json().charged_credit).toBe(true);
    const ledger = await ctx.pool.query("SELECT delta, reason FROM credit_ledger");
    expect(ledger.rows).toEqual([{ delta: -1, reason: "teklif" }]);
    expect((await ctx.app.inject({ method: "POST", url: `/api/requests/${ids[2]}/offers`, headers: { cookie: seller }, payload: offer(18000) })).statusCode).toBe(402);
  });

  it("teklif notundaki telefon gizlenir", async () => {
    const buyer = await login(ctx, "05321112233");
    const seller = await login(ctx, "05321112244");
    const id = await createRequest(ctx, buyer);
    await ctx.app.inject({ method: "POST", url: `/api/requests/${id}/offers`, headers: { cookie: seller }, payload: offer(18000, "Beni 0533 444 55 66'dan arayın") });
    const o = (await ctx.app.inject({ url: `/api/requests/${id}`, headers: { cookie: buyer } })).json().offers[0];
    expect(o.note).not.toContain("444");
  });

  it("alıcı teklifi kabul eder: talep kapanır, diğer teklifler reddedilir, satıcıya haber gider", async () => {
    const buyer = await login(ctx, "05321112233");
    const s1 = await login(ctx, "05321112244");
    const s2 = await login(ctx, "05321112255");
    const id = await createRequest(ctx, buyer);
    const o1 = (await ctx.app.inject({ method: "POST", url: `/api/requests/${id}/offers`, headers: { cookie: s1 }, payload: offer(18000) })).json().id;
    await ctx.app.inject({ method: "POST", url: `/api/requests/${id}/offers`, headers: { cookie: s2 }, payload: offer(19000) });

    expect((await ctx.app.inject({ method: "POST", url: `/api/offers/${o1}/accept`, headers: { cookie: s2 } })).statusCode).toBe(404);
    expect((await ctx.app.inject({ method: "POST", url: `/api/offers/${o1}/accept`, headers: { cookie: buyer } })).statusCode).toBe(200);
    expect(ctx.outbox.last("905321112244")?.text).toContain("kabul edildi");

    const { rows } = await ctx.pool.query("SELECT status FROM offers ORDER BY id");
    expect(rows.map((r) => r.status)).toEqual(["accepted", "rejected"]);
    const req = (await ctx.pool.query("SELECT status, accepted_offer_id FROM requests WHERE id = $1", [id])).rows[0];
    expect(req).toEqual({ status: "closed", accepted_offer_id: o1 });
    // Kapanan talebe yeni teklif verilemez.
    const s3 = await login(ctx, "05321112266");
    expect((await ctx.app.inject({ method: "POST", url: `/api/requests/${id}/offers`, headers: { cookie: s3 }, payload: offer(15000) })).statusCode).toBe(409);
  });
});

describe("Bana Özel", () => {
  it("alarm kurulur, uygun yeni talep satıcıya bildirilir ve eşleşmelerde görünür", async () => {
    const seller = await login(ctx, "05321112244");
    const buyer = await login(ctx, "05321112233");
    const a = await ctx.app.inject({ method: "POST", url: "/api/me/alarms", headers: { cookie: seller }, payload: { category_id: "elektronik", city: "İstanbul", min_budget: 10000 } });
    expect(a.statusCode).toBe(201);
    const id = await createRequest(ctx, buyer);
    await new Promise((r) => setTimeout(r, 50));
    expect(ctx.outbox.last("905321112244")?.text).toContain("alarmınıza uyan");
    const m = (await ctx.app.inject({ url: "/api/me/matches", headers: { cookie: seller } })).json();
    expect(m.items.map((x: { id: number }) => x.id)).toEqual([id]);
  });

  it("taleplerim, tekliflerim ve favoriler listelenir", async () => {
    const buyer = await login(ctx, "05321112233");
    const seller = await login(ctx, "05321112244");
    const id = await createRequest(ctx, buyer);
    await ctx.app.inject({ method: "POST", url: `/api/requests/${id}/offers`, headers: { cookie: seller }, payload: offer(18000) });
    await ctx.app.inject({ method: "PUT", url: `/api/me/favorites/${id}`, headers: { cookie: seller } });
    expect((await ctx.app.inject({ url: "/api/me/requests", headers: { cookie: buyer } })).json().items[0]).toMatchObject({ id, offer_count: 1 });
    expect((await ctx.app.inject({ url: "/api/me/offers", headers: { cookie: seller } })).json().items[0]).toMatchObject({ request_id: id, price: 18000 });
    expect((await ctx.app.inject({ url: "/api/me/favorites", headers: { cookie: seller } })).json().items).toHaveLength(1);
    expect((await ctx.app.inject({ url: `/api/requests/${id}`, headers: { cookie: seller } })).json().request.is_favorite).toBe(true);
  });
});
