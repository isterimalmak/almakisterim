import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRequest, login, makeApp, resetData, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
beforeAll(async () => { ctx = await makeApp(); await resetData(ctx.pool); });
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });

describe("SEO ve Ölçüm", () => {
  it("yönetici Analytics kimliğini ve doğrulama kodlarını kaydeder; site verisinde herkese açık döner; hatalı kod reddedilir", async () => {
    const admin = await login(ctx, "yonetici@almakisterim.com", "Yönetici");
    const user = await login(ctx, "05321118001", "Üye");
    const put = (cookie: string, payload: Record<string, unknown>) => ctx.app.inject({ method: "PUT", url: "/api/admin/seo", headers: { cookie }, payload });
    expect((await put(user, { ga4_id: "G-AB12CD34EF" })).statusCode).toBe(403);
    const r = await put(admin, { ga4_id: "g-ab12cd34ef", gsc: "Abc_123-xyzXYZabc", bing: "0123456789ABCDEF0123456789ABCDEF" });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().tracking).toEqual({ ga4_id: "G-AB12CD34EF", gsc: "Abc_123-xyzXYZabc", bing: "0123456789ABCDEF0123456789ABCDEF" });
    expect((await ctx.app.inject({ url: "/api/categories" })).json().tracking).toEqual({ ga4_id: "G-AB12CD34EF", gsc: "Abc_123-xyzXYZabc", bing: "0123456789ABCDEF0123456789ABCDEF" });
    // Etiketin tamamı yapıştırılırsa ya da kimlik G- ile başlamazsa reddedilir; boş bırakılan alan silinir.
    expect((await put(admin, { gsc: '<meta name="google-site-verification" content="x">' })).statusCode).toBe(400);
    expect((await put(admin, { ga4_id: "UA-1234-1" })).statusCode).toBe(400);
    expect((await put(admin, { bing: "" })).json().tracking.bing).toBe("");
  });

  it("talep verenin geldiği yer saklanır; rapor arama motorlarını, yapay zekâ sohbetlerini, ilk sayfayı ve kategoriyi ayırır", async () => {
    await resetData(ctx.pool);
    const admin = await login(ctx, "yonetici@almakisterim.com", "Yönetici");
    const buyer = await login(ctx, "05321118002", "Rapor Alıcı");
    await ctx.pool.query("INSERT INTO settings (key, value) VALUES ('max_active_requests_per_user', '0') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value");
    await createRequest(ctx, buyer, { source: { ref: "www.google.com.tr", landing: "/telefonumu-satmak-istiyorum" } });
    await createRequest(ctx, buyer, { source: { ref: "www.google.com", landing: "/telefonumu-satmak-istiyorum" } });
    await createRequest(ctx, buyer, { source: { ref: "www.bing.com", landing: "/" } });
    await createRequest(ctx, buyer, { source: { ref: "gemini.google.com", landing: "/" } });
    await createRequest(ctx, buyer, { source: { ref: "l.facebook.com", landing: "/" } });
    await createRequest(ctx, buyer);
    // Geçersiz kaynak bilgisi talebi engellemez, yalnız yok sayılır.
    await createRequest(ctx, buyer, { source: { ref: "kötü site/../", landing: "javascript:alert(1)" } });
    const { rows } = await ctx.pool.query("SELECT source_ref, source_landing FROM requests ORDER BY id");
    expect(rows[0]).toEqual({ source_ref: "www.google.com.tr", source_landing: "/telefonumu-satmak-istiyorum" });
    expect(rows[6]).toEqual({ source_ref: "", source_landing: "" });

    const rep = (await ctx.app.inject({ url: "/api/admin/seo?days=30", headers: { cookie: admin } })).json().report;
    expect(rep).toMatchObject({ days: 30, total: 7, organic: 3, direct: 2 });
    expect(rep.engines).toEqual([{ name: "Google", count: 2 }, { name: "Bing", count: 1 }]);
    expect(rep.ai).toEqual([{ name: "Gemini", count: 1 }]);
    expect(rep.landings[0]).toEqual({ name: "/telefonumu-satmak-istiyorum", count: 2 });
    expect(rep.categories).toEqual([{ name: "Elektronik", count: 3 }]);
    expect(rep.others).toEqual([{ name: "l.facebook.com", count: 1 }]);
    expect((await ctx.app.inject({ url: "/api/admin/seo", headers: { cookie: buyer } })).statusCode).toBe(403);
  });
});
