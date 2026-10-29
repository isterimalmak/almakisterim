import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createRequest, login, makeApp, postOffer, resetData, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
beforeEach(async () => {
  ctx ??= await makeApp();
  await resetData(ctx.pool);
  ctx.push.sent.length = 0;
});
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });

const device = (cookie: string, token: string, platform = "android") =>
  ctx.app.inject({ method: "POST", url: "/api/me/push-token", headers: { cookie }, payload: { token: `ExponentPushToken[${token}]`, platform } });
const pushesTo = (token: string) => ctx.push.sent.filter((m) => m.to === `ExponentPushToken[${token}]`);
// Teklif ve kabul bildirimleri yanıttan sonra gönderilir; kısa bir bekleme.
const settle = () => new Promise((r) => setTimeout(r, 50));

describe("telefon uygulaması bildirimleri", () => {
  it("yeni teklif alıcıya, kabul satıcıya, mesaj karşı tarafa bildirim olarak gider; ilgili sayfayı açar", async () => {
    const buyer = await login(ctx, "05321118001", "Alıcı Bir");
    const seller = await login(ctx, "05321118002", "Satıcı Bir");
    await device(buyer, "alici", "ios");
    await device(seller, "satici");
    const id = await createRequest(ctx, buyer, { title: "iPhone 14 almak istiyorum" });

    const offer = (await postOffer(ctx, seller, id, { price: 18000 })).json().id;
    await settle();
    expect(pushesTo("alici").at(-1)).toMatchObject({ title: "almakisterim", body: '"iPhone 14 almak istiyorum" talebinize yeni bir teklif geldi.', data: { link: `/talep/${id}` } });

    expect((await ctx.app.inject({ method: "POST", url: `/api/requests/${id}/messages`, headers: { cookie: seller }, payload: { body: "Merhaba, ürün elimde." } })).statusCode).toBeLessThan(300);
    expect(pushesTo("alici").at(-1)!.body).toContain("yeni mesajınız var");

    expect((await ctx.app.inject({ method: "POST", url: `/api/offers/${offer}/accept`, headers: { cookie: buyer } })).statusCode).toBe(200);
    await settle();
    expect(pushesTo("satici").at(-1)).toMatchObject({ body: '"iPhone 14 almak istiyorum" talebi için verdiğiniz teklif kabul edildi.', data: { link: `/talep/${id}` } });
    // Site içi bildirimlerde de görünür.
    const bell = (await ctx.app.inject({ url: "/api/me/notifications", headers: { cookie: seller } })).json().items.map((n: { text: string }) => n.text);
    expect(bell).toContain('"iPhone 14 almak istiyorum" talebi için verdiğiniz teklif kabul edildi.');
  });

  it("üye kapattığı türde telefon bildirimi almaz; site içi bildirim yine düşer", async () => {
    const buyer = await login(ctx, "05321118003", "Alıcı İki");
    const seller = await login(ctx, "05321118004", "Satıcı İki");
    await device(buyer, "alici2");
    const me = (await ctx.app.inject({ url: "/api/me", headers: { cookie: buyer } })).json().user;
    expect(me.push_prefs).toEqual({ offer: true, accepted: true, message: true, alarm: true, request: true, news: true });
    expect(me.push_devices).toBe(1);

    expect((await ctx.app.inject({ method: "PATCH", url: "/api/me", headers: { cookie: buyer }, payload: { push_prefs: { offer: false } } })).statusCode).toBe(200);
    expect((await ctx.app.inject({ method: "PATCH", url: "/api/me", headers: { cookie: buyer }, payload: { push_prefs: { bilinmeyen: false } } })).statusCode).toBe(400);
    expect((await ctx.app.inject({ url: "/api/me", headers: { cookie: buyer } })).json().user.push_prefs).toMatchObject({ offer: false, message: true });

    const id = await createRequest(ctx, buyer, { title: "Laptop almak istiyorum" });
    ctx.push.sent.length = 0;
    await postOffer(ctx, seller, id, { price: 25000 });
    await settle();
    expect(pushesTo("alici2").filter((m) => m.body.includes("teklif"))).toEqual([]);
    const bell = (await ctx.app.inject({ url: "/api/me/notifications", headers: { cookie: buyer } })).json().items.map((n: { text: string }) => n.text);
    expect(bell).toContain('"Laptop almak istiyorum" talebinize yeni bir teklif geldi.');
    // Kapatılmayan tür (mesaj) gitmeye devam eder.
    await ctx.app.inject({ method: "POST", url: `/api/requests/${id}/messages`, headers: { cookie: seller }, payload: { body: "Merhaba, laptop elimde." } });
    expect(pushesTo("alici2").at(-1)!.body).toContain("yeni mesajınız var");
  });

  it("yönetim duyurusu: önce kendine dene, sonra seçilen gruba; duyuruları kapatanlara gitmez; geçmişte görünür", async () => {
    const admin = await login(ctx, "yonetici@almakisterim.com", "Yönetici");
    const buyer = await login(ctx, "05321118005", "Alıcı Üç");
    const seller = await login(ctx, "05321118006", "Satıcı Üç");
    const quiet = await login(ctx, "05321118007", "Sessiz Üye");
    await createRequest(ctx, buyer, { title: "Bisiklet almak istiyorum" });
    const id = await createRequest(ctx, buyer, { title: "Kamera almak istiyorum" });
    await ctx.app.inject({ method: "POST", url: `/api/requests/${id}/unlock`, headers: { cookie: seller } });
    await device(buyer, "b1", "ios"); await device(buyer, "b2");
    await device(seller, "s1");
    await device(quiet, "q1");
    await ctx.app.inject({ method: "PATCH", url: "/api/me", headers: { cookie: quiet }, payload: { push_prefs: { news: false } } });

    const send = (payload: Record<string, unknown>, cookie = admin) => ctx.app.inject({ method: "POST", url: "/api/admin/push/send", headers: { cookie }, payload });
    const msg = { title: "Hafta sonu fırsatı", body: "Bu hafta sonu talep verenlere öne çıkarma ücretsiz.", link: "/talep-ver" };

    // Yalnız yönetici; kendi cihazı yoksa "Kendime dene" yol gösterir.
    expect((await send({ ...msg, audience: "all" }, buyer)).statusCode).toBe(403);
    const noDev = await send({ ...msg, audience: "test" });
    expect(noDev.statusCode).toBe(409);
    expect(noDev.json().message).toContain("Uygulamada bu hesapla giriş yapıp");
    expect((await send({ ...msg, link: "https://baska.site", audience: "test" })).statusCode).toBe(400);
    expect((await send({ ...msg, title: "x", audience: "test" })).statusCode).toBe(400);

    await device(admin, "yon");
    ctx.push.sent.length = 0;
    const t = await send({ ...msg, audience: "test" });
    expect(t.statusCode, t.body).toBe(201);
    expect(t.json()).toMatchObject({ recipients: 1, devices: 1, delivered: 1, failed: 0 });
    expect(ctx.push.sent).toEqual([{ to: "ExponentPushToken[yon]", title: "Hafta sonu fırsatı", body: msg.body, sound: "default", data: { link: "/talep-ver" } }]);

    const stats = (await ctx.app.inject({ url: "/api/admin/push", headers: { cookie: admin } })).json();
    expect(stats.devices).toEqual({ ios: 1, android: 4 });
    // Duyuruları kapatan üye sayılmaz.
    expect(stats.audiences.all).toEqual({ users: 3, devices: 4 });
    expect(stats.audiences.buyers).toEqual({ users: 1, devices: 2 });
    expect(stats.audiences.sellers).toEqual({ users: 1, devices: 1 });
    expect(stats.my_devices).toBe(1);

    ctx.push.gone.add("ExponentPushToken[b2]");
    ctx.push.sent.length = 0;
    const b = await send({ ...msg, audience: "buyers" });
    expect(b.json()).toMatchObject({ recipients: 1, devices: 2, delivered: 1, failed: 1 });
    expect(ctx.push.sent.map((m) => m.to).sort()).toEqual(["ExponentPushToken[b1]", "ExponentPushToken[b2]"]);
    // Silinmiş cihaz listeden çıkar.
    expect((await ctx.pool.query("SELECT count(*)::int AS n FROM push_tokens WHERE token = 'ExponentPushToken[b2]'")).rows[0].n).toBe(0);

    ctx.push.sent.length = 0;
    expect((await send({ ...msg, audience: "all" })).json()).toMatchObject({ recipients: 3, devices: 3 });
    expect(ctx.push.sent.map((m) => m.to)).not.toContain("ExponentPushToken[q1]");

    const history = (await ctx.app.inject({ url: "/api/admin/push", headers: { cookie: admin } })).json().campaigns;
    expect(history.map((c: { audience: string }) => c.audience)).toEqual(["all", "buyers", "test"]);
    expect(history[0]).toMatchObject({ title: "Hafta sonu fırsatı", created_by: "Yönetici", delivered: 3 });
  });
});
