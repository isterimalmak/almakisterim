import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRequest, login, makeApp, resetData, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
beforeAll(async () => { ctx = await makeApp(); await resetData(ctx.pool); });
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });
const sitemap = async () => (await ctx.app.inject({ url: "/api/seo/sitemap" })).json();

describe("site haritası verisi", () => {
  it("yalnız herkese açık içerik: yayındaki talepler, talebi olan kategoriler, yayındaki blog, sayfalar ve görünen sözleşmeler", async () => {
    const buyer = await login(ctx, "05321117001", "Site Haritası");
    const open = await createRequest(ctx, buyer, { title: "iPhone 15 almak istiyorum" });
    const closed = await createRequest(ctx, buyer, { title: "Kapanan talep" });
    const pending = await createRequest(ctx, buyer, { title: "İncelemedeki talep" });
    const expired = await createRequest(ctx, buyer, { title: "Süresi dolan talep" });
    await ctx.pool.query("UPDATE requests SET status = 'closed' WHERE id = $1", [closed]);
    await ctx.pool.query("UPDATE requests SET status = 'pending_review' WHERE id = $1", [pending]);
    await ctx.pool.query("UPDATE requests SET expires_at = now() - interval '1 day' WHERE id = $1", [expired]);
    await ctx.pool.query("INSERT INTO blog_posts (slug, title, summary, body, status, published_at) VALUES ('yayinda', 'Yayında', 'Özet', 'Metin', 'published', now()), ('taslak', 'Taslak', 'Özet', 'Metin', 'draft', NULL)");

    let d = await sitemap();
    expect(d.requests.map((r: { id: number }) => r.id)).toEqual([open]);
    expect(d.requests[0]).toMatchObject({ title: "iPhone 15 almak istiyorum", city: "İstanbul" });
    // Talebi olan kategori ve üst kategorisi listelenir; boş kategoriler listelenmez.
    expect(d.categories).toContainEqual({ top: "elektronik", sub: "telefon", count: 1 });
    expect(d.categories).toContainEqual({ top: "elektronik", sub: null, count: 1 });
    expect(d.categories.find((c: { top: string }) => c.top === "emlak")).toBeUndefined();
    expect(d.blog.map((b: { slug: string }) => b.slug)).toEqual(["yayinda"]);
    expect(d.pages.map((p: { slug: string }) => p.slug)).toContain("hakkimizda");
    expect(d.legal).toContain("uyelik-sozlesmesi");
    expect(d.legal).toContain("guvenli-al-sozlesmesi");

    // Gizlenen kategori ve gizlenen ödeme bölümü metni haritadan çıkar.
    const admin = await login(ctx, "yonetici@almakisterim.com", "Yönetici");
    await ctx.app.inject({ method: "PATCH", url: "/api/admin/categories/telefon", headers: { cookie: admin }, payload: { is_visible: false } });
    await ctx.app.inject({ method: "PUT", url: "/api/admin/settings", headers: { cookie: admin }, payload: { show_safe: false } });
    d = await sitemap();
    expect(d.requests).toEqual([]);
    expect(d.categories.find((c: { sub: string | null }) => c.sub === "telefon")).toBeUndefined();
    expect(d.legal).not.toContain("guvenli-al-sozlesmesi");
    expect(d.show_safe).toBe(false);
    // Herkese açık uç numara ya da üye bilgisi içermez.
    expect(JSON.stringify(d)).not.toMatch(/90532|buyer/);
  });
});

describe("il sayfaları", () => {
  it("il, il+kategori ve il+alt kategori sayıları; site haritasına yalnız yeterince talebi olanlar girer", async () => {
    await resetData(ctx.pool);
    const buyer = await login(ctx, "05321117002", "İl Sayfası");
    for (let i = 0; i < 3; i++) await createRequest(ctx, buyer, { title: `İzmir telefon ${i}`, city: "İzmir", district: "Karşıyaka" });
    await createRequest(ctx, buyer, { title: "Ankara telefon", city: "Ankara", district: "Çankaya" });
    const closed = await createRequest(ctx, buyer, { title: "Kapanan İzmir", city: "İzmir", district: "Karşıyaka" });
    await ctx.pool.query("UPDATE requests SET status = 'closed' WHERE id = $1", [closed]);

    const d = (await ctx.app.inject({ url: "/api/seo/places" })).json();
    expect(d.min).toBe(3);
    expect(d.places).toContainEqual({ city: "İzmir", top: null, sub: null, count: 3 });
    expect(d.places).toContainEqual({ city: "İzmir", top: "elektronik", sub: null, count: 3 });
    expect(d.places).toContainEqual({ city: "İzmir", top: "elektronik", sub: "telefon", count: 3 });
    expect(d.places).toContainEqual({ city: "Ankara", top: "elektronik", sub: "telefon", count: 1 });

    const s = await sitemap();
    expect(s.places.map((p: { city: string }) => p.city)).toEqual(["İzmir", "İzmir", "İzmir"]);

    // Gizlenen kategorinin talepleri il sayılarından da çıkar.
    const admin = await login(ctx, "yonetici@almakisterim.com", "Yönetici");
    await ctx.app.inject({ method: "PATCH", url: "/api/admin/categories/telefon", headers: { cookie: admin }, payload: { is_visible: false } });
    expect((await ctx.app.inject({ url: "/api/seo/places" })).json().places).toEqual([]);
    await ctx.app.inject({ method: "PATCH", url: "/api/admin/categories/telefon", headers: { cookie: admin }, payload: { is_visible: true } });
  });
});
