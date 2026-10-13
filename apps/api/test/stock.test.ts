import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { cleanupOrphans } from "../src/modules/media.js";
import { createRequest, login, makeApp, resetData, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
beforeEach(async () => {
  ctx ??= await makeApp();
  await resetData(ctx.pool);
});
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });

const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(300).fill(7)]);
async function upload(cookie: string) {
  const t = (await ctx.app.inject({ method: "POST", url: "/api/media/uploads", headers: { cookie }, payload: { content_type: "image/jpeg", size: JPG.length } })).json();
  await ctx.app.inject({ method: "PUT", url: t.upload.url, headers: { "content-type": "image/jpeg" }, payload: JPG });
  return (await ctx.app.inject({ method: "POST", url: `/api/media/${t.id}/complete`, headers: { cookie } })).json() as { id: string; url: string };
}

describe("hazır görsel galerisi", () => {
  it("yönetici etiketli görsel ekler; alıcı talebine uyanları önce görür, seçip talebe ekler", async () => {
    const admin = await login(ctx, "yonetici@almakisterim.com");
    const add = async (payload: Record<string, unknown>) => {
      const r = await ctx.app.inject({ method: "POST", url: "/api/admin/stock-images", headers: { cookie: admin }, payload: { media_id: (await upload(admin)).id, ...payload } });
      expect(r.statusCode, r.body).toBe(201);
      return r.json() as { id: number; media: { url: string } };
    };
    const bmw3 = await add({ category_id: "otomobil", marka: "BMW", model: "3 Serisi", title: "BMW 3 Serisi" });
    await add({ category_id: "otomobil", marka: "BMW", title: "BMW genel" });
    await add({ category_id: "otomobil", marka: "Fiat", model: "Egea", title: "Egea" });
    await add({ category_id: "vasita", title: "Genel araba" });
    await add({ category_id: "satilik", title: "Daire" });

    const list = (await ctx.app.inject({ url: `/api/stock-images?category=otomobil&araclar=${encodeURIComponent("BMW:3 Serisi")}` })).json().items;
    expect(list.map((x: { title: string }) => x.title).slice(0, 2)).toEqual(["BMW 3 Serisi", "BMW genel"]);
    expect(list.map((x: { title: string }) => x.title)).toContain("Genel araba");
    expect(list.map((x: { title: string }) => x.title)).not.toContain("Daire");
    expect(list[0].match).toBe("model");
    // Başka markanın görseli (Fiat Egea) BMW talebinde çıkmaz; marka seçilmemişse hepsi çıkar.
    expect(list.map((x: { title: string }) => x.title)).not.toContain("Egea");
    const bentley = (await ctx.app.inject({ url: `/api/stock-images?category=otomobil&araclar=${encodeURIComponent("Bentley:")}` })).json().items;
    expect(bentley.map((x: { title: string }) => x.title)).toEqual(["Genel araba"]);
    const all = (await ctx.app.inject({ url: "/api/stock-images?category=otomobil" })).json().items;
    expect(all.map((x: { title: string }) => x.title)).toContain("Egea");

    const buyer = await login(ctx, "05321112233");
    const used = await ctx.app.inject({ method: "POST", url: `/api/stock-images/${bmw3.id}/use`, headers: { cookie: buyer } });
    expect(used.statusCode).toBe(201);
    expect(used.json().url).toBe(bmw3.media.url);
    const id = await createRequest(ctx, buyer, { media_ids: [used.json().id] });
    const r = (await ctx.app.inject({ url: `/api/requests/${id}` })).json().request;
    expect(r.media[0].url).toBe(bmw3.media.url);
  });

  it("alıcı galeriden seçtiğini kaldırınca ya da süresi dolunca asıl dosya ve galeri görseli kalır", async () => {
    const admin = await login(ctx, "yonetici@almakisterim.com");
    const s = (await ctx.app.inject({ method: "POST", url: "/api/admin/stock-images", headers: { cookie: admin }, payload: { media_id: (await upload(admin)).id, category_id: "otomobil" } })).json();
    const buyer = await login(ctx, "05321112233");
    const a = (await ctx.app.inject({ method: "POST", url: `/api/stock-images/${s.id}/use`, headers: { cookie: buyer } })).json();
    expect((await ctx.app.inject({ method: "DELETE", url: `/api/media/${a.id}`, headers: { cookie: buyer } })).statusCode).toBe(200);
    await ctx.app.inject({ method: "POST", url: `/api/stock-images/${s.id}/use`, headers: { cookie: buyer } });
    await ctx.pool.query("UPDATE media SET created_at = now() - interval '3 days'");
    await cleanupOrphans(ctx.pool, ctx.storage);
    // Asıl görsel galeride durur ve dosyası hâlâ açılır.
    const items = (await ctx.app.inject({ url: "/api/stock-images?category=otomobil" })).json().items;
    expect(items).toHaveLength(1);
    expect((await ctx.app.inject({ url: items[0].media.url })).statusCode).toBe(200);
  });

  it("yalnızca yönetici ekler; yayından kaldırılan görsel listede çıkmaz ve seçilemez", async () => {
    const admin = await login(ctx, "yonetici@almakisterim.com");
    const user = await login(ctx, "05321112233");
    expect((await ctx.app.inject({ method: "POST", url: "/api/admin/stock-images", headers: { cookie: user }, payload: { media_id: (await upload(user)).id, category_id: "otomobil" } })).statusCode).toBe(403);
    const s = (await ctx.app.inject({ method: "POST", url: "/api/admin/stock-images", headers: { cookie: admin }, payload: { media_id: (await upload(admin)).id, category_id: "otomobil" } })).json();
    await ctx.app.inject({ method: "PATCH", url: `/api/admin/stock-images/${s.id}`, headers: { cookie: admin }, payload: { is_active: false } });
    expect((await ctx.app.inject({ url: "/api/stock-images?category=otomobil" })).json().items).toHaveLength(0);
    expect((await ctx.app.inject({ method: "POST", url: `/api/stock-images/${s.id}/use`, headers: { cookie: user } })).statusCode).toBe(404);
  });
});
