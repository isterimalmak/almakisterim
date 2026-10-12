import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createRequest, login, makeApp, resetData, sampleRequest, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
beforeEach(async () => {
  ctx ??= await makeApp();
  await resetData(ctx.pool);
});
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });

describe("yönetim paneli", () => {
  it("yönetici olmayan kullanıcı giremez", async () => {
    const user = await login(ctx, "05321112233");
    expect((await ctx.app.inject({ url: "/api/admin/stats", headers: { cookie: user } })).statusCode).toBe(403);
    expect((await ctx.app.inject({ url: "/api/admin/stats" })).statusCode).toBe(401);
  });

  it("kategori gizlenir ve tekrar açılır; gizliyken sitede görünmez", async () => {
    const admin = await login(ctx, "yonetici@almakisterim.com");
    const hide = await ctx.app.inject({ method: "PATCH", url: "/api/admin/categories/vasita", headers: { cookie: admin }, payload: { is_visible: false } });
    expect(hide.statusCode).toBe(200);
    const pub = (await ctx.app.inject({ url: "/api/categories" })).json().categories.map((c: { id: string }) => c.id);
    expect(pub).not.toContain("vasita");
    const all = (await ctx.app.inject({ url: "/api/admin/categories", headers: { cookie: admin } })).json().categories;
    expect(all.find((c: { id: string }) => c.id === "vasita").is_visible).toBe(false);
    await ctx.app.inject({ method: "PATCH", url: "/api/admin/categories/vasita", headers: { cookie: admin }, payload: { is_visible: true } });
    expect((await ctx.app.inject({ url: "/api/categories" })).json().categories.map((c: { id: string }) => c.id)).toContain("vasita");
  });

  it("incelemedeki talep onaylanınca yayına girer", async () => {
    const admin = await login(ctx, "yonetici@almakisterim.com");
    const user = await login(ctx, "05321112233");
    const r = await ctx.app.inject({ method: "POST", url: "/api/requests", headers: { cookie: user }, payload: { ...sampleRequest, title: "Kaçak sigara almak istiyorum" } });
    const id = r.json().id;
    const mod = (await ctx.app.inject({ url: "/api/admin/moderation", headers: { cookie: admin } })).json();
    expect(mod.pending.map((p: { id: number }) => p.id)).toEqual([id]);
    await ctx.app.inject({ method: "POST", url: `/api/admin/requests/${id}/approve`, headers: { cookie: admin } });
    expect((await ctx.app.inject({ url: "/api/requests" })).json().total).toBe(1);
    await ctx.app.inject({ method: "POST", url: `/api/admin/requests/${id}/remove`, headers: { cookie: admin } });
    expect((await ctx.app.inject({ url: "/api/requests" })).json().total).toBe(0);
  });

  it("şikayetler yönetici listesine düşer", async () => {
    const admin = await login(ctx, "yonetici@almakisterim.com");
    const user = await login(ctx, "05321112233");
    const id = await createRequest(ctx, user);
    await ctx.app.inject({ method: "POST", url: `/api/requests/${id}/report`, payload: { reason: "Sahte talep" } });
    const mod = (await ctx.app.inject({ url: "/api/admin/moderation", headers: { cookie: admin } })).json();
    expect(mod.reports[0]).toMatchObject({ request_id: id, reason: "Sahte talep" });
  });

  it("ayarlar güncellenir ve kredi tanımlanır", async () => {
    const admin = await login(ctx, "yonetici@almakisterim.com");
    await login(ctx, "05321112233");
    await ctx.app.inject({ method: "PUT", url: "/api/admin/settings", headers: { cookie: admin }, payload: { free_offers_per_month: 3 } });
    expect((await ctx.app.inject({ url: "/api/admin/settings", headers: { cookie: admin } })).json().free_offers_per_month).toBe(3);
    const u = (await ctx.app.inject({ url: "/api/admin/users?q=905321112233", headers: { cookie: admin } })).json().items[0];
    const r = await ctx.app.inject({ method: "POST", url: `/api/admin/users/${u.id}/credits`, headers: { cookie: admin }, payload: { delta: 50 } });
    expect(r.json().credits).toBe(50);
    const neg = await ctx.app.inject({ method: "POST", url: `/api/admin/users/${u.id}/credits`, headers: { cookie: admin }, payload: { delta: -100 } });
    expect(neg.statusCode).toBe(400);
  });
});

describe("zamanlanmış iş", () => {
  it("anahtarsız çağrı reddedilir; doğru anahtarla süresi dolan talepler kapanır", async () => {
    const user = await login(ctx, "05321112233");
    const id = await createRequest(ctx, user);
    await ctx.pool.query("UPDATE requests SET expires_at = now() - interval '1 minute' WHERE id = $1", [id]);
    expect((await ctx.app.inject({ method: "POST", url: "/api/jobs/expire", headers: { "x-job-token": "yanlis" } })).statusCode).toBe(401);
    const r = await ctx.app.inject({ method: "POST", url: "/api/jobs/expire", headers: { "x-job-token": "test-job-token-123" } });
    expect(r.json().expired).toBe(1);
    expect((await ctx.pool.query("SELECT status FROM requests WHERE id = $1", [id])).rows[0].status).toBe("expired");
  });

  it("sağlık kontrolü veritabanına ulaşır", async () => {
    const r = await ctx.app.inject({ url: "/api/health" });
    expect(r.json()).toEqual({ ok: true });
  });
});
