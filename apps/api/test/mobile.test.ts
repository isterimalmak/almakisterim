import { generateKeyPairSync, sign } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequest, makeApp, resetData, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
beforeEach(async () => {
  ctx ??= await makeApp();
  await resetData(ctx.pool);
});
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });

const APP = { "x-ak-app": "1" };
// Uygulama gibi giriş: kod ister, doğrular, oturum anahtarını yanıtın gövdesinden alır.
async function appLogin(target: string, name = "Uygulama Üyesi") {
  const channel = target.includes("@") ? "email" : "sms";
  await ctx.app.inject({ method: "POST", url: "/api/auth/code", headers: APP, payload: { channel, target } });
  const code = ctx.outbox.sent.filter((m) => /giriş kodunuz/.test(m.text)).at(-1)!.text.match(/\d{6}/)![0];
  const r = await ctx.app.inject({ method: "POST", url: "/api/auth/verify", headers: APP, payload: { channel, target, code, name } });
  expect(r.statusCode, r.body).toBe(200);
  expect(r.cookies.find((c) => c.name === "ak_session")).toBeUndefined();
  const token = r.json().token as string;
  await ctx.app.inject({ method: "POST", url: "/api/me/consents", headers: { ...APP, "x-ak-session": token }, payload: { terms: true, context: "uygulama" } });
  return token;
}
const as = (token: string) => ({ ...APP, "x-ak-session": token });

describe("telefon uygulaması", () => {
  it("oturum çerez yerine başlıkla taşınır; çıkışta oturum ve bildirim adresi silinir", async () => {
    const token = await appLogin("05321112233", "Elif Sönmez");
    expect(token).toMatch(/^[\w-]{20,}$/);
    expect((await ctx.app.inject({ url: "/api/me", headers: as(token) })).json().user).toMatchObject({ phone: "905321112233", name: "Elif Sönmez" });
    // Başlık olmadan ya da sahte anahtarla girişsiz sayılır.
    expect((await ctx.app.inject({ url: "/api/me" })).json().user).toBeNull();
    expect((await ctx.app.inject({ url: "/api/me", headers: as("sahte-anahtar-1234567890") })).json().user).toBeNull();

    const push = "ExponentPushToken[abcDEF123]";
    expect((await ctx.app.inject({ method: "POST", url: "/api/me/push-token", headers: as(token), payload: { token: push, platform: "android" } })).statusCode).toBe(200);
    expect((await ctx.app.inject({ method: "POST", url: "/api/me/push-token", headers: as(token), payload: { token: "rastgele", platform: "android" } })).statusCode).toBe(400);
    expect((await ctx.app.inject({ method: "POST", url: "/api/me/push-token", payload: { token: push, platform: "ios" } })).statusCode).toBe(401);

    expect((await ctx.app.inject({ method: "POST", url: "/api/auth/logout", headers: as(token), payload: { push_token: push } })).statusCode).toBe(200);
    expect((await ctx.app.inject({ url: "/api/me", headers: as(token) })).json().user).toBeNull();
    expect((await ctx.pool.query("SELECT count(*)::int AS n FROM push_tokens")).rows[0].n).toBe(0);
  });

  it("bildirim gelince telefona anlık bildirim gider; geçersiz adres silinir", async () => {
    const buyer = await appLogin("05321112233", "Elif Sönmez");
    await ctx.app.inject({ method: "POST", url: "/api/me/push-token", headers: as(buyer), payload: { token: "ExponentPushToken[alici1]", platform: "ios" } });
    await ctx.app.inject({ method: "POST", url: "/api/me/push-token", headers: as(buyer), payload: { token: "ExponentPushToken[eski]", platform: "android" } });
    const id = await createRequest(ctx, `ak_session=${buyer}`);
    const seller = await appLogin("05321112244", "Can Yıldız");

    const sent: { url: string; body: { to: string; title: string; body: string; data: { link: string } }[] }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      sent.push({ url, body });
      return Response.json({ data: body.map((m: { to: string }) => (m.to.includes("eski") ? { status: "error", details: { error: "DeviceNotRegistered" } } : { status: "ok" })) });
    });
    // Satıcı numarayı açınca alıcıya bildirim düşer.
    expect((await ctx.app.inject({ method: "POST", url: `/api/requests/${id}/unlock`, headers: as(seller) })).statusCode).toBeLessThan(300);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.url).toBe("https://exp.host/--/api/v2/push/send");
    expect(sent[0]!.body.map((m) => m.to).sort()).toEqual(["ExponentPushToken[alici1]", "ExponentPushToken[eski]"]);
    expect(sent[0]!.body[0]).toMatchObject({ title: "almakisterim", data: { link: `/talep/${id}` } });
    expect(sent[0]!.body[0]!.body).toContain("talebiniz");
    expect((await ctx.pool.query("SELECT token FROM push_tokens")).rows.map((r) => r.token)).toEqual(["ExponentPushToken[alici1]"]);

    // Bildirim servisi çökse de akış bozulmaz.
    vi.stubGlobal("fetch", async () => { throw new Error("ağ yok"); });
    await ctx.app.inject({ method: "POST", url: `/api/requests/${id}/messages`, headers: as(seller), payload: { body: "Merhaba, ürün elimde." } });
    expect((await ctx.pool.query("SELECT count(*)::int AS n FROM messages")).rows[0].n).toBe(1);
  });

  it("Google ile giriş: telefonun tarayıcısında yapılır, uygulamaya tek kullanımlık bilet döner", async () => {
    const g = await makeApp({
      google: {
        enabled: true,
        authUrl: (state) => `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`,
        exchange: async () => ({ sub: "google-app-1", email: "ayse@gmail.com", name: "Ayşe K" }),
      },
    });
    try {
      const start = await g.app.inject({ url: "/api/auth/google?app=1" });
      const state = new URL(start.headers.location as string).searchParams.get("state")!;
      const cookie = start.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
      expect(cookie).toContain("ak_g_app=1");

      const bad = await g.app.inject({ url: `/api/auth/google/callback?code=x&state=baska`, headers: { cookie } });
      expect(bad.headers.location).toBe("almakisterim://giris?hata=google");

      const ok = await g.app.inject({ url: `/api/auth/google/callback?code=x&state=${state}`, headers: { cookie } });
      const loc = String(ok.headers.location);
      expect(loc).toMatch(/^almakisterim:\/\/giris\?bilet=/);
      expect(ok.cookies.find((c) => c.name === "ak_session")).toBeUndefined();
      const bilet = new URL(loc).searchParams.get("bilet")!;

      const t = await g.app.inject({ method: "POST", url: "/api/auth/app-ticket", headers: APP, payload: { bilet } });
      expect(t.statusCode, t.body).toBe(200);
      const me = await g.app.inject({ url: "/api/me", headers: as(t.json().token) });
      expect(me.json().user).toMatchObject({ email: "ayse@gmail.com", name: "Ayşe K" });
      // Bilet bir kez kullanılır.
      expect((await g.app.inject({ method: "POST", url: "/api/auth/app-ticket", headers: APP, payload: { bilet } })).json().error).toBe("bilet_gecersiz");

      // Sitedeki (uygulamasız) Google girişi eskisi gibi çerezle döner.
      const web = await g.app.inject({ url: "/api/auth/google" });
      const st2 = new URL(web.headers.location as string).searchParams.get("state")!;
      const c2 = web.cookies.filter((c) => c.name === "ak_oauth_state").map((c) => `${c.name}=${c.value}`).join("; ");
      const back = await g.app.inject({ url: `/api/auth/google/callback?code=x&state=${st2}`, headers: { cookie: c2 } });
      expect(back.headers.location).toBe("http://localhost:3000/");
    } finally { await g.app.close(); await g.pool.end(); }
  });

  it("Apple ile Giriş: Apple imzalı jeton doğrulanır, hesap açılır ya da aynı e-postalı hesaba bağlanır; sahte/yanlış uygulamalı jeton reddedilir", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const jwk = { ...publicKey.export({ format: "jwk" }), kid: "test-kid", alg: "RS256", use: "sig" };
    vi.stubGlobal("fetch", async (url: string) => (url === "https://appleid.apple.com/auth/keys" ? Response.json({ keys: [jwk] }) : new Response("", { status: 404 })));
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const jwt = (claims: object, key = privateKey) => {
      const h = b64({ alg: "RS256", kid: "test-kid" }), p = b64(claims);
      return `${h}.${p}.${sign("RSA-SHA256", Buffer.from(`${h}.${p}`), key).toString("base64url")}`;
    };
    const exp = Math.floor(Date.now() / 1000) + 600;
    const claims = { iss: "https://appleid.apple.com", aud: "com.almakisterim.app", sub: "apple-001", email: "Zeynep@Example.com", email_verified: "true", exp };
    const apple = (identity_token: string, name?: string) => ctx.app.inject({ method: "POST", url: "/api/auth/apple", headers: APP, payload: { identity_token, ...(name ? { name } : {}) } });

    // Aynı e-postayla daha önce kodla girilmiş hesap Apple'a bağlanır.
    const old = await appLogin("zeynep@example.com", "Zeynep Ak");
    let r = await apple(jwt(claims), "Zeynep A");
    expect(r.statusCode, r.body).toBe(200);
    const me = (await ctx.app.inject({ url: "/api/me", headers: as(r.json().token) })).json().user;
    const before = (await ctx.app.inject({ url: "/api/me", headers: as(old) })).json().user;
    expect(me.id).toBe(before.id);
    expect(me.name).toBe("Zeynep Ak");

    // Yeni Apple kimliği (gizli e-posta yok) yeni hesap açar.
    r = await apple(jwt({ ...claims, sub: "apple-002", email: undefined, email_verified: undefined }), "Mert Can");
    expect((await ctx.app.inject({ url: "/api/me", headers: as(r.json().token) })).json().user).toMatchObject({ name: "Mert Can", email: null });

    const otherKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
    expect((await apple(jwt(claims, otherKey))).json().error).toBe("apple_gecersiz");
    expect((await apple(jwt({ ...claims, aud: "com.baska.app" }))).json().error).toBe("apple_gecersiz");
    expect((await apple(jwt({ ...claims, exp: Math.floor(Date.now() / 1000) - 10 }))).json().error).toBe("apple_gecersiz");
    expect((await apple(jwt({ ...claims, iss: "https://sahte.com" }))).json().error).toBe("apple_gecersiz");
  });

  it("uygulamadan siteye geçiş: tek kullanımlık bilet sitede oturum açar, yalnızca sitenin sayfasına yönlendirir", async () => {
    const token = await appLogin("05321112299", "Köprü Üye");
    expect((await ctx.app.inject({ method: "POST", url: "/api/auth/web-ticket", headers: APP })).statusCode).toBe(401);
    const { bilet } = (await ctx.app.inject({ method: "POST", url: "/api/auth/web-ticket", headers: as(token) })).json();
    const r = await ctx.app.inject({ url: `/api/auth/web?bilet=${bilet}&next=${encodeURIComponent("/guvenli-al")}` });
    expect(r.statusCode).toBe(302);
    expect(r.headers.location).toBe("http://localhost:3000/guvenli-al");
    const cookie = r.cookies.find((c) => c.name === "ak_session")!;
    expect((await ctx.app.inject({ url: "/api/me", headers: { cookie: `ak_session=${cookie.value}` } })).json().user.name).toBe("Köprü Üye");
    // Bilet bir kez kullanılır; başka siteye yönlendirme yapılmaz.
    expect((await ctx.app.inject({ url: `/api/auth/web?bilet=${bilet}` })).headers.location).toBe("http://localhost:3000/giris?hata=sure");
    const b2 = (await ctx.app.inject({ method: "POST", url: "/api/auth/web-ticket", headers: as(token) })).json().bilet;
    expect((await ctx.app.inject({ url: `/api/auth/web?bilet=${b2}&next=${encodeURIComponent("//kotu.com")}` })).headers.location).toBe("http://localhost:3000/");
  });
});
