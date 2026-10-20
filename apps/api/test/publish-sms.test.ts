import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { login, makeApp, resetData, sampleRequest, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
beforeEach(async () => {
  ctx ??= await makeApp();
  await resetData(ctx.pool);
  await ctx.pool.query("UPDATE settings SET value = 'true' WHERE key = 'publish_sms'");
});
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });

const lastCode = () => ctx.outbox.sent.at(-1)!.text.match(/\d{6}/)![0];
const post = (cookie: string, payload: Record<string, unknown>) =>
  ctx.app.inject({ method: "POST", url: "/api/requests", headers: { cookie }, payload: { ...sampleRequest, ...payload } });
const count = async () => (await ctx.pool.query<{ n: number }>("SELECT count(*)::int AS n FROM requests")).rows[0]!.n;

describe("talep verirken SMS onayı", () => {
  it("kodsuz, başka numarayla ya da hatalı kodla talep yayınlanmaz; kayıtlı numaraya gelen kodla yayınlanır, kod bir kez kullanılır", async () => {
    const buyer = await login(ctx, "05321112233");
    let r = await post(buyer, {});
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toBe("telefon_onayi_gerekli");

    // Hesapta kayıtlı olmayan numaraya kod gönderilmez.
    r = await ctx.app.inject({ method: "POST", url: "/api/me/publish-code", headers: { cookie: buyer }, payload: { phone: "05329998877" } });
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toBe("numara_farkli");

    // Girişten hemen sonra da kod istenebilir.
    r = await ctx.app.inject({ method: "POST", url: "/api/me/publish-code", headers: { cookie: buyer }, payload: { phone: "0532 111 22 33" } });
    expect(r.statusCode).toBe(200);
    const sms = ctx.outbox.sent.at(-1)!;
    expect(sms.to).toBe("905321112233");
    expect(sms.text).toContain("talep onay kodunuz");
    const code = lastCode();

    r = await post(buyer, { phone: "05321112233", phone_code: code === "000000" ? "111111" : "000000" });
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toBe("kod_hatali");
    expect(await count()).toBe(0);

    r = await post(buyer, { phone: "05321112233", phone_code: code });
    expect(r.statusCode).toBe(201);
    expect(await count()).toBe(1);

    r = await post(buyer, { phone: "05321112233", phone_code: code });
    expect(r.statusCode).toBe(400);
    expect(await count()).toBe(1);
  });

  it("numarası olmayan üye (e-postayla giren) yazdığı numarayı doğrular, numara hesabına eklenir; başkasının numarası kullanılamaz", async () => {
    await login(ctx, "05445556677", "Başka Üye");
    const buyer = await login(ctx, "alici@example.com");
    let r = await ctx.app.inject({ method: "POST", url: "/api/me/publish-code", headers: { cookie: buyer }, payload: { phone: "05445556677" } });
    expect(r.statusCode).toBe(409);

    r = await ctx.app.inject({ method: "POST", url: "/api/me/publish-code", headers: { cookie: buyer }, payload: { phone: "05051234567" } });
    expect(r.statusCode).toBe(200);
    r = await post(buyer, { phone: "05051234567", phone_code: lastCode() });
    expect(r.statusCode).toBe(201);
    const me = (await ctx.app.inject({ url: "/api/me", headers: { cookie: buyer } })).json();
    expect((me.user ?? me).phone).toBe("905051234567");
  });

  it("ayar kapalıysa kod istenmez ve ayar sitede görünür", async () => {
    expect((await ctx.app.inject({ url: "/api/categories" })).json().publish_sms).toBe(true);
    await ctx.pool.query("UPDATE settings SET value = 'false' WHERE key = 'publish_sms'");
    const buyer = await login(ctx, "05321112233");
    expect((await post(buyer, {})).statusCode).toBe(201);
    expect((await ctx.app.inject({ url: "/api/categories" })).json().publish_sms).toBe(false);
  });
});
