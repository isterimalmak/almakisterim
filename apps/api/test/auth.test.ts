import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { login, makeApp, resetData, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
beforeEach(async () => {
  ctx ??= await makeApp();
  await resetData(ctx.pool);
});
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });

describe("giriş", () => {
  it("SMS koduyla giriş yapar, oturum açar ve /me kullanıcıyı döner", async () => {
    const cookie = await login(ctx, "0532 111 22 33", "Elif Sönmez");
    const me = await ctx.app.inject({ url: "/api/me", headers: { cookie } });
    expect(me.json().user).toMatchObject({ name: "Elif Sönmez", phone: "905321112233", role: "user", free_offers_left: 5 });
  });

  it("e-posta koduyla giriş yapar; yönetici e-postası yönetici olur", async () => {
    const cookie = await login(ctx, "Yonetici@Almakisterim.com");
    const me = await ctx.app.inject({ url: "/api/me", headers: { cookie } });
    expect(me.json().user).toMatchObject({ email: "yonetici@almakisterim.com", role: "admin" });
  });

  it("veritabanında kodun kendisi değil özeti saklanır", async () => {
    await ctx.app.inject({ method: "POST", url: "/api/auth/code", payload: { channel: "sms", target: "05321112233" } });
    const code = ctx.outbox.sent.at(-1)!.text.match(/\d{6}/)![0];
    const { rows } = await ctx.pool.query("SELECT code_hash FROM auth_codes");
    expect(rows[0].code_hash).not.toContain(code);
    expect(rows[0].code_hash).toHaveLength(64);
  });

  it("yanlış kodu reddeder ve 5 hatalı denemeden sonra doğru kodu da kabul etmez", async () => {
    await ctx.app.inject({ method: "POST", url: "/api/auth/code", payload: { channel: "sms", target: "05321112233" } });
    const code = ctx.outbox.sent.at(-1)!.text.match(/\d{6}/)![0];
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) {
      const r = await ctx.app.inject({ method: "POST", url: "/api/auth/verify", payload: { channel: "sms", target: "05321112233", code: wrong } });
      expect(r.statusCode).toBe(400);
    }
    const r = await ctx.app.inject({ method: "POST", url: "/api/auth/verify", payload: { channel: "sms", target: "05321112233", code } });
    expect(r.statusCode).toBe(400);
  });

  it("aynı numaraya 1 dakika içinde ikinci kodu göndermez", async () => {
    const a = await ctx.app.inject({ method: "POST", url: "/api/auth/code", payload: { channel: "sms", target: "05321112233" } });
    const b = await ctx.app.inject({ method: "POST", url: "/api/auth/code", payload: { channel: "sms", target: "05321112233" } });
    expect(a.statusCode).toBe(200);
    expect(b.statusCode).toBe(429);
  });

  it("geçersiz telefon numarasını reddeder", async () => {
    const r = await ctx.app.inject({ method: "POST", url: "/api/auth/code", payload: { channel: "sms", target: "12345" } });
    expect(r.statusCode).toBe(400);
  });

  it("çıkış yapınca oturum geçersiz olur", async () => {
    const cookie = await login(ctx, "05321112233");
    await ctx.app.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie } });
    const me = await ctx.app.inject({ url: "/api/me", headers: { cookie } });
    expect(me.json().user).toBeNull();
  });

  it("Google ile giriş yapılandırılmadıysa 503 döner", async () => {
    const r = await ctx.app.inject({ url: "/api/auth/google" });
    expect(r.statusCode).toBe(503);
  });
});

describe("Google ile giriş", () => {
  it("geri dönüşte state doğrulanır, kullanıcı açılır ve oturum başlar", async () => {
    const g = await makeApp({
      google: {
        enabled: true,
        authUrl: (state) => `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`,
        exchange: async () => ({ sub: "google-123", email: "elif@gmail.com", name: "Elif S" }),
      },
    });
    const start = await g.app.inject({ url: "/api/auth/google" });
    expect(start.statusCode).toBe(302);
    const state = new URL(start.headers.location as string).searchParams.get("state")!;
    const stateCookie = start.cookies.find((c) => c.name === "ak_oauth_state")!;

    const bad = await g.app.inject({ url: `/api/auth/google/callback?code=x&state=baska`, headers: { cookie: `ak_oauth_state=${stateCookie.value}` } });
    expect(bad.headers.location).toContain("/giris?hata=google");

    const ok = await g.app.inject({ url: `/api/auth/google/callback?code=x&state=${state}`, headers: { cookie: `ak_oauth_state=${stateCookie.value}` } });
    expect(ok.headers.location).toBe("http://localhost:3000/");
    const session = ok.cookies.find((c) => c.name === "ak_session")!;
    const me = await g.app.inject({ url: "/api/me", headers: { cookie: `ak_session=${session.value}` } });
    expect(me.json().user).toMatchObject({ email: "elif@gmail.com", name: "Elif S" });
    await g.app.close(); await g.pool.end();
  });
});
