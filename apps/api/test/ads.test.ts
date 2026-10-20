import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { cleanupOrphans } from "../src/modules/media.js";
import { login, makeApp, resetData, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
beforeEach(async () => {
  ctx ??= await makeApp();
  await resetData(ctx.pool);
});
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });

const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(300).fill(7)]);

async function upload(cookie: string, type = "image/jpeg", body = JPG) {
  const t = await ctx.app.inject({ method: "POST", url: "/api/media/uploads", headers: { cookie }, payload: { content_type: type, size: body.length } });
  const { id, upload: up } = t.json();
  await ctx.app.inject({ method: "PUT", url: up.url, headers: { "content-type": type }, payload: body });
  return (await ctx.app.inject({ method: "POST", url: `/api/media/${id}/complete`, headers: { cookie } })).json() as { id: string; url: string };
}

describe("reklam alanları", () => {
  it("ana sayfa: vitrin ve son talepler gizlenebilir; ortadaki reklamlar ayrı döner, yeri sonradan değiştirilir", async () => {
    const admin = await login(ctx, "yonetici@almakisterim.com");
    let cats = (await ctx.app.inject({ url: "/api/categories" })).json();
    expect(cats).toMatchObject({ home_vitrin: true, home_latest: true });
    expect((await ctx.app.inject({ method: "PUT", url: "/api/admin/settings", headers: { cookie: admin }, payload: { home_vitrin: false, home_latest: false } })).statusCode).toBe(200);
    cats = (await ctx.app.inject({ url: "/api/categories" })).json();
    expect(cats).toMatchObject({ home_vitrin: false, home_latest: false });

    const post = (payload: Record<string, unknown>) => ctx.app.inject({ method: "POST", url: "/api/admin/tanitim", headers: { cookie: admin }, payload });
    const mid = (await post({ media_id: (await upload(admin)).id, title: "Orta reklam", placement: "orta" })).json();
    await post({ media_id: (await upload(admin)).id, title: "Sol reklam" });
    expect((await post({ media_id: (await upload(admin)).id, placement: "ust" })).statusCode).toBe(400);
    let pub = (await ctx.app.inject({ url: "/api/tanitim" })).json();
    expect(pub.center.map((x: { title: string }) => x.title)).toEqual(["Orta reklam"]);
    expect(pub.items.map((x: { title: string }) => x.title)).toEqual(["Sol reklam"]);
    await ctx.app.inject({ method: "PATCH", url: `/api/admin/tanitim/${mid.id}`, headers: { cookie: admin }, payload: { placement: "sol" } });
    pub = (await ctx.app.inject({ url: "/api/tanitim" })).json();
    expect(pub.center).toEqual([]);
    expect(pub.items).toHaveLength(2);
  });

  it("yönetici istediği kadar resim/video reklam ekler; ana sayfada sırayla, yalnızca açık olanlar görünür", async () => {
    const admin = await login(ctx, "yonetici@almakisterim.com");
    const add = async (payload: Record<string, unknown>) => {
      const r = await ctx.app.inject({ method: "POST", url: "/api/admin/tanitim", headers: { cookie: admin }, payload });
      expect(r.statusCode, r.body).toBe(201);
      return r.json() as { id: number; media: { kind: string; url: string } };
    };
    const a = await add({ media_id: (await upload(admin)).id, title: "Oto galeri", link_url: "https://ornek.com" });
    const b = await add({ media_id: (await upload(admin, "video/mp4", Buffer.from("video"))).id, title: "Video reklam" });
    const c = await add({ media_id: (await upload(admin)).id, title: "Kapalı", is_active: false });
    expect(b.media.kind).toBe("video");

    let pub = (await ctx.app.inject({ url: "/api/tanitim" })).json().items;
    expect(pub.map((x: { title: string }) => x.title)).toEqual(["Oto galeri", "Video reklam"]);
    expect(pub[0]).toMatchObject({ link_url: "https://ornek.com", media: { kind: "image" } });

    // Sırayı değiştir, kapalıyı aç, bağlantıyı kaldır.
    expect((await ctx.app.inject({ method: "POST", url: "/api/admin/tanitim/order", headers: { cookie: admin }, payload: { ids: [c.id, b.id, a.id] } })).statusCode).toBe(200);
    expect((await ctx.app.inject({ method: "PATCH", url: `/api/admin/tanitim/${c.id}`, headers: { cookie: admin }, payload: { is_active: true } })).json().is_active).toBe(true);
    expect((await ctx.app.inject({ method: "PATCH", url: `/api/admin/tanitim/${a.id}`, headers: { cookie: admin }, payload: { link_url: "" } })).json().link_url).toBeNull();
    // "www…" diye yazılan adresin başına https:// eklenir.
    const patchLink = (link_url: string) => ctx.app.inject({ method: "PATCH", url: `/api/admin/tanitim/${a.id}`, headers: { cookie: admin }, payload: { link_url } });
    expect((await patchLink("www.ornek.com/kampanya")).json().link_url).toBe("https://www.ornek.com/kampanya");
    expect((await patchLink("instagram.com/almakisterim")).json().link_url).toBe("https://instagram.com/almakisterim");
    expect((await patchLink("/kategori/vasita")).json().link_url).toBe("/kategori/vasita");
    pub = (await ctx.app.inject({ url: "/api/tanitim" })).json().items;
    expect(pub.map((x: { title: string }) => x.title)).toEqual(["Kapalı", "Video reklam", "Oto galeri"]);

    // Karşılama: tek reklam işaretlenir; yenisi işaretlenince eskisi kalkar, kapatılınca karşılama olmaz.
    const welcome = (id: number, is_welcome: boolean) => ctx.app.inject({ method: "PATCH", url: `/api/admin/tanitim/${id}`, headers: { cookie: admin }, payload: { is_welcome } });
    expect((await ctx.app.inject({ url: "/api/tanitim" })).json().welcome).toBeNull();
    expect((await welcome(b.id, true)).json().is_welcome).toBe(true);
    expect((await ctx.app.inject({ url: "/api/tanitim" })).json().welcome).toMatchObject({ id: b.id, media: { kind: "video" } });
    await welcome(c.id, true);
    const adm = (await ctx.app.inject({ url: "/api/admin/tanitim", headers: { cookie: admin } })).json().items;
    expect(adm.filter((x: { is_welcome: boolean }) => x.is_welcome).map((x: { id: number }) => x.id)).toEqual([c.id]);
    await welcome(c.id, false);
    expect((await ctx.app.inject({ url: "/api/tanitim" })).json().welcome).toBeNull();

    // Silinen reklamın dosyası da silinir.
    expect((await ctx.app.inject({ method: "DELETE", url: `/api/admin/tanitim/${b.id}`, headers: { cookie: admin } })).statusCode).toBe(200);
    expect((await ctx.app.inject({ url: "/api/admin/tanitim", headers: { cookie: admin } })).json().items).toHaveLength(2);
    expect((await ctx.pool.query("SELECT count(*)::int AS n FROM media")).rows[0].n).toBe(2);
  });

  it("yalnızca yönetici ekler; geçersiz bağlantı ve başkasının dosyası reddedilir", async () => {
    const user = await login(ctx, "05321112233");
    const admin = await login(ctx, "yonetici@almakisterim.com");
    const mine = await upload(user);
    expect((await ctx.app.inject({ method: "POST", url: "/api/admin/tanitim", headers: { cookie: user }, payload: { media_id: mine.id } })).statusCode).toBe(403);
    expect((await ctx.app.inject({ method: "POST", url: "/api/admin/tanitim", headers: { cookie: admin }, payload: { media_id: mine.id } })).json().error).toBe("medya_gecersiz");
    const m = await upload(admin);
    expect((await ctx.app.inject({ method: "POST", url: "/api/admin/tanitim", headers: { cookie: admin }, payload: { media_id: m.id, link_url: "javascript:alert(1)" } })).statusCode).toBe(400);
  });

  it("reklam dosyaları günlük temizlikte silinmez ve talebe eklenemez", async () => {
    const admin = await login(ctx, "yonetici@almakisterim.com");
    const m = await upload(admin);
    await ctx.app.inject({ method: "POST", url: "/api/admin/tanitim", headers: { cookie: admin }, payload: { media_id: m.id } });
    await ctx.pool.query("UPDATE media SET created_at = now() - interval '3 days'");
    expect(await cleanupOrphans(ctx.pool, ctx.storage)).toBe(0);
    expect((await ctx.app.inject({ method: "DELETE", url: `/api/media/${m.id}`, headers: { cookie: admin } })).statusCode).toBe(404);
    expect((await ctx.app.inject({ url: "/api/tanitim" })).json().items).toHaveLength(1);
  });
});

describe("vitrin", () => {
  it("yöneticinin öne çıkardığı talep vitrinde en başta, sonra fotoğraflılar ve en yeniler gelir", async () => {
    const { createRequest } = await import("./helpers.js");
    const buyer = await login(ctx, "05321112233");
    const admin = await login(ctx, "yonetici@almakisterim.com");
    const a = await createRequest(ctx, buyer, { title: "Eski talep öne çıkacak" });
    const pic = await upload(buyer);
    await createRequest(ctx, buyer, { title: "Fotoğraflı talep", media_ids: [pic.id] });
    await createRequest(ctx, buyer, { title: "En yeni talep" });
    const titles = async (qs: string) => (await ctx.app.inject({ url: `/api/requests?${qs}` })).json().items.map((r: { title: string }) => r.title);
    expect(await titles("sort=vitrin")).toEqual(["Fotoğraflı talep", "En yeni talep", "Eski talep öne çıkacak"]);

    expect((await ctx.app.inject({ method: "POST", url: `/api/admin/requests/${a}/vitrin`, headers: { cookie: buyer }, payload: { days: 30 } })).statusCode).toBe(403);
    expect((await ctx.app.inject({ method: "POST", url: `/api/admin/requests/${a}/vitrin`, headers: { cookie: admin }, payload: { days: 30 } })).json().featured_until).toBeTruthy();
    expect(await titles("sort=vitrin")).toEqual(["Eski talep öne çıkacak", "Fotoğraflı talep", "En yeni talep"]);
    expect(await titles("featured=1")).toEqual(["Eski talep öne çıkacak"]);
    expect((await ctx.app.inject({ url: `/api/requests/${a}` })).json().request.is_featured).toBe(true);

    await ctx.app.inject({ method: "POST", url: `/api/admin/requests/${a}/vitrin`, headers: { cookie: admin }, payload: { days: 0 } });
    expect(await titles("featured=1")).toEqual([]);
  });
});
