import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createRequest, login, makeApp, postOffer, resetData, sampleRequest, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
beforeEach(async () => {
  ctx ??= await makeApp();
  await resetData(ctx.pool);
});
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });

const unlock = (cookie: string, id: number) => ctx.app.inject({ method: "POST", url: `/api/requests/${id}/unlock`, headers: { cookie } });
const detail = async (id: number, cookie?: string) => (await ctx.app.inject({ url: `/api/requests/${id}`, headers: cookie ? { cookie } : {} })).json();
const setting = (key: string, value: unknown) => ctx.pool.query("UPDATE settings SET value = $2 WHERE key = $1", [key, JSON.stringify(value)]);

describe("numarayı gör", () => {
  it("satıcı numarayı açar; numarayı yalnızca o görür, alıcı kimin gördüğünü görür", async () => {
    const buyer = await login(ctx, "05321112233", "Elif Sönmez");
    const seller = await login(ctx, "05321112244", "Ahmet Kaya");
    const other = await login(ctx, "05321112255");
    const id = await createRequest(ctx, buyer);

    const before = await detail(id, seller);
    expect(before.contact).toMatchObject({ unlocked: false, phone: null, price: 1, slots_left: 10 });
    expect(JSON.stringify(await detail(id))).not.toContain("905321112233");

    const r = await unlock(seller, id);
    expect(r.statusCode).toBe(201);
    expect(r.json()).toMatchObject({ phone: "905321112233", free: true, charged_credits: 0 });
    // Tekrar açmak ücretsizdir ve hak harcamaz.
    expect((await unlock(seller, id)).statusCode).toBe(200);
    expect((await ctx.pool.query("SELECT count(*)::int AS n FROM contact_unlocks")).rows[0].n).toBe(1);

    expect((await detail(id, seller)).contact).toMatchObject({ unlocked: true, phone: "905321112233", slots_left: 9 });
    expect((await detail(id, other)).contact).toMatchObject({ unlocked: false, phone: null });
    expect((await detail(id, other)).contact.viewers).toBeUndefined();
    expect((await detail(id, buyer)).contact.viewers).toEqual([expect.objectContaining({ seller_name: "Ahmet K." })]);
    expect((await unlock(buyer, id)).statusCode).toBe(400);
  });

  it("ücretsiz hak bitince kredi düşer, kredi yetmezse 402; kategori fiyatı uygulanır", async () => {
    await setting("free_unlocks_per_month", 1);
    await setting("unlock_price_by_top", { elektronik: 3 });
    const buyer = await login(ctx, "05321112233");
    const seller = await login(ctx, "05321112244");
    const ids = [await createRequest(ctx, buyer), await createRequest(ctx, buyer), await createRequest(ctx, buyer)];

    expect((await unlock(seller, ids[0]!)).json()).toMatchObject({ free: true });
    const no = await unlock(seller, ids[1]!);
    expect(no.statusCode).toBe(402);
    expect(no.json().message).toContain("3 kredi");

    await ctx.pool.query("UPDATE users SET credits = 4 WHERE phone = '905321112244'");
    expect((await unlock(seller, ids[1]!)).json()).toMatchObject({ free: false, charged_credits: 3 });
    expect((await ctx.pool.query("SELECT credits FROM users WHERE phone = '905321112244'")).rows[0].credits).toBe(1);
    expect((await ctx.pool.query("SELECT delta, reason, ref FROM credit_ledger")).rows).toEqual([{ delta: -3, reason: "numara", ref: `request:${ids[1]}` }]);
    expect((await unlock(seller, ids[2]!)).statusCode).toBe(402);
    expect((await ctx.app.inject({ url: "/api/me", headers: { cookie: seller } })).json().user.free_unlocks_left).toBe(0);
  });

  it("bir talepte numarayı en fazla N satıcı görebilir", async () => {
    await setting("unlock_limit_per_request", 2);
    const buyer = await login(ctx, "05321112233");
    const id = await createRequest(ctx, buyer);
    for (const p of ["05321112244", "05321112255"]) expect((await unlock(await login(ctx, p), id)).statusCode).toBe(201);
    const third = await unlock(await login(ctx, "05321112266"), id);
    expect(third.statusCode).toBe(409);
    expect(third.json().error).toBe("sinir_doldu");
    expect((await detail(id)).contact.slots_left).toBe(0);
  });

  it("talep kapanınca numara gizlenir, teklifi kabul edilen satıcıda açık kalır", async () => {
    const buyer = await login(ctx, "05321112233");
    const s1 = await login(ctx, "05321112244");
    const s2 = await login(ctx, "05321112255");
    const id = await createRequest(ctx, buyer);
    const o1 = (await postOffer(ctx, s1, id, { price: 18000 })).json().id;
    await postOffer(ctx, s2, id, { price: 19000 });
    await ctx.app.inject({ method: "POST", url: `/api/offers/${o1}/accept`, headers: { cookie: buyer } });
    expect((await detail(id, s1)).contact.phone).toBe("905321112233");
    expect((await detail(id, s2)).contact.phone).toBeNull();
    // Kapanan talep yeni satıcıya açılmaz.
    expect((await unlock(await login(ctx, "05321112266"), id)).statusCode).toBe(409);
  });

  it("talep vermek için doğrulanmış telefon ve paylaşım onayı gerekir", async () => {
    const mailUser = await login(ctx, "elif@example.com");
    const noPhone = await ctx.app.inject({ method: "POST", url: "/api/requests", headers: { cookie: mailUser }, payload: sampleRequest });
    expect(noPhone.statusCode).toBe(409);
    expect(noPhone.json().error).toBe("telefon_gerekli");

    const phoneUser = await login(ctx, "05321112233");
    const noConsent = await ctx.app.inject({ method: "POST", url: "/api/requests", headers: { cookie: phoneUser }, payload: { ...sampleRequest, contact_consent: false } });
    expect(noConsent.statusCode).toBe(400);
    const id = await createRequest(ctx, phoneUser);
    expect((await ctx.pool.query("SELECT contact_consent_at IS NOT NULL AS ok FROM requests WHERE id = $1", [id])).rows[0].ok).toBe(true);
  });

  it("e-posta ile giren kullanıcı SMS koduyla telefon ekler; başkasının numarası eklenemez", async () => {
    const u = await login(ctx, "elif@example.com");
    const c = await ctx.app.inject({ method: "POST", url: "/api/me/phone/code", headers: { cookie: u }, payload: { phone: "0532 111 22 77" } });
    expect(c.statusCode).toBe(200);
    const code = ctx.outbox.last("905321112277")!.text.match(/\d{6}/)![0];
    const bad = await ctx.app.inject({ method: "POST", url: "/api/me/phone/verify", headers: { cookie: u }, payload: { phone: "05321112277", code: code === "000000" ? "111111" : "000000" } });
    expect(bad.statusCode).toBe(400);
    const ok = await ctx.app.inject({ method: "POST", url: "/api/me/phone/verify", headers: { cookie: u }, payload: { phone: "05321112277", code } });
    expect(ok.statusCode).toBe(200);
    expect((await ctx.app.inject({ url: "/api/me", headers: { cookie: u } })).json().user.phone).toBe("905321112277");
    expect((await createRequest(ctx, u))).toBeGreaterThan(0);

    await login(ctx, "05321112288");
    const other = await login(ctx, "mehmet@example.com");
    const taken = await ctx.app.inject({ method: "POST", url: "/api/me/phone/code", headers: { cookie: other }, payload: { phone: "05321112288" } });
    expect(taken.statusCode).toBe(409);
  });
});
