import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createRequest, login, makeApp, resetData, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
beforeEach(async () => {
  ctx ??= await makeApp();
  await resetData(ctx.pool);
});
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });

describe("yönetim paneli", () => {
  it("ana ekran sayaçları, son 7 gün, son 6 ay ve son hareketleri verir", async () => {
    const admin = await login(ctx, "yonetici@almakisterim.com");
    const buyer = await login(ctx, "05321112233");
    const seller = await login(ctx, "05331112233");
    const id = await createRequest(ctx, buyer, { title: "Panel testi bisiklet" });
    expect((await ctx.app.inject({ method: "POST", url: `/api/requests/${id}/unlock`, headers: { cookie: seller } })).statusCode).toBe(201);

    expect((await ctx.app.inject({ url: "/api/admin/dashboard", headers: { cookie: buyer } })).statusCode).toBe(403);
    const d = (await ctx.app.inject({ url: "/api/admin/dashboard", headers: { cookie: admin } })).json();
    expect(d.totals).toMatchObject({ users: 3, users_today: 3, active_requests: 1, requests_month: 1, unlocks_month: 1 });
    expect(d.users_7d).toHaveLength(7);
    expect(d.users_7d.at(-1).n).toBe(3);
    expect(d.months).toHaveLength(6);
    expect(d.months.at(-1)).toMatchObject({ requests: 1 });
    expect(d.recent.map((x: { kind: string }) => x.kind)).toEqual(expect.arrayContaining(["uye", "talep", "numara"]));
    expect(d.recent.find((x: { kind: string }) => x.kind === "talep")).toMatchObject({ text: "Panel testi bisiklet", request_id: id });
  });

  it("bütün talepler aranır ve duruma göre süzülür; üyelerde talep ve numara sayısı görünür", async () => {
    const admin = await login(ctx, "yonetici@almakisterim.com");
    const buyer = await login(ctx, "05321112244");
    const a = await createRequest(ctx, buyer, { title: "Kırmızı koltuk arıyorum" });
    const b = await createRequest(ctx, buyer, { title: "PS5 arıyorum" });
    await ctx.app.inject({ method: "POST", url: `/api/admin/requests/${b}/remove`, headers: { cookie: admin }, payload: {} });

    const list = async (qs: string) => (await ctx.app.inject({ url: `/api/admin/requests?${qs}`, headers: { cookie: admin } })).json();
    expect((await list("")).total).toBe(2);
    expect((await list("q=koltuk")).items.map((x: { id: number }) => x.id)).toEqual([a]);
    expect((await list("status=active")).items.map((x: { id: number }) => x.id)).toEqual([a]);
    expect((await list("status=rejected")).items.map((x: { id: number }) => x.id)).toEqual([b]);
    expect((await list(`q=${b}`)).items[0]).toMatchObject({ id: b, title: "PS5 arıyorum", unlocks: 0, messages: 0 });

    const users = (await ctx.app.inject({ url: "/api/admin/users?q=05321112244", headers: { cookie: admin } })).json().items;
    expect(users[0]).toMatchObject({ requests: 2, unlocks: 0 });
  });

  it("bildirim seçilen kitleye gider; entegrasyon durumu anahtarı göstermez; üyeler CSV indirilir; kredi hareketleri listelenir", async () => {
    const admin = await login(ctx, "yonetici@almakisterim.com");
    const buyer = await login(ctx, "05321112255");
    await login(ctx, "05321112266");
    await createRequest(ctx, buyer);
    const notify = (payload: Record<string, unknown>) => ctx.app.inject({ method: "POST", url: "/api/admin/notify", headers: { cookie: admin }, payload });
    expect((await notify({ text: "Alıcılara duyuru", link: "/kategori", audience: "buyers" })).json().sent).toBe(1);
    expect((await notify({ text: "Herkese duyuru", audience: "all" })).json().sent).toBe(3);
    expect((await notify({ text: "x", audience: "all" })).statusCode).toBe(400);
    expect((await notify({ text: "Kötü bağlantı", link: "javascript:alert(1)", audience: "all" })).statusCode).toBe(400);
    const texts = async (phone: string) => (await ctx.pool.query("SELECT n.text FROM notifications n JOIN users u ON u.id = n.user_id WHERE u.phone LIKE '%' || $1 ORDER BY n.id", [phone])).rows.map((r) => r.text);
    expect(await texts("5321112255")).toEqual(["Alıcılara duyuru", "Herkese duyuru"]);
    expect(await texts("5321112266")).toEqual(["Herkese duyuru"]);

    const integ = (await ctx.app.inject({ url: "/api/admin/integrations", headers: { cookie: admin } })).json();
    expect(integ.groups.find((x: { id: string }) => x.id === "storage").connected).toBe(true);
    expect(integ.groups.find((x: { id: string }) => x.id === "ai").connected).toBe(false);
    expect(integ.pay.name).toContain("Ödeme");

    const csv = await ctx.app.inject({ url: "/api/admin/users.csv", headers: { cookie: admin } });
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.body.startsWith("\uFEFFAd Soyad;E-posta;Telefon")).toBe(true);
    expect(csv.body.split("\r\n")).toHaveLength(4);
    expect((await ctx.app.inject({ url: "/api/admin/users.csv", headers: { cookie: buyer } })).statusCode).toBe(403);

    const u = (await ctx.app.inject({ url: "/api/admin/users?q=05321112266", headers: { cookie: admin } })).json().items[0];
    await ctx.app.inject({ method: "POST", url: `/api/admin/users/${u.id}/credits`, headers: { cookie: admin }, payload: { delta: 7 } });
    const led = (await ctx.app.inject({ url: "/api/admin/credits", headers: { cookie: admin } })).json().items;
    expect(led[0]).toMatchObject({ delta: 7, reason: "yonetici" });
  });
});
