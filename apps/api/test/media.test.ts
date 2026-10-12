import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { HeuristicAi } from "../src/services/ai.js";
import { disabledStorage } from "../src/services/storage.js";
import { createRequest, login, makeApp, resetData, sampleRequest, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
beforeEach(async () => {
  ctx ??= await makeApp();
  await resetData(ctx.pool);
});
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });

const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(300).fill(7)]);

// Yükleme izni al → dosyayı imzalı adrese gönder → tamamla.
async function upload(c: TestCtx, cookie: string, type = "image/jpeg", body = JPG) {
  const t = await c.app.inject({ method: "POST", url: "/api/media/uploads", headers: { cookie }, payload: { content_type: type, size: body.length } });
  expect(t.statusCode, t.body).toBe(201);
  const { id, upload: up } = t.json();
  const put = await c.app.inject({ method: "PUT", url: up.url, headers: { "content-type": type }, payload: body });
  expect(put.statusCode).toBe(200);
  const done = await c.app.inject({ method: "POST", url: `/api/media/${id}/complete`, headers: { cookie } });
  expect(done.statusCode, done.body).toBe(200);
  return done.json() as { id: string; kind: string; url: string };
}

const offer = (media_ids: string[] = []) => ({ price: 18000, condition: "İkinci el, çok iyi", delivery: "Elden teslim", warranty: false, note: "", media_ids });

describe("fotoğraf ve video", () => {
  it("alıcı fotoğraf yükler, talebe ekler; talep sayfasında ve listede görünür", async () => {
    const buyer = await login(ctx, "05321112233", "Elif Sönmez");
    const a = await upload(ctx, buyer);
    const b = await upload(ctx, buyer, "image/png", Buffer.from("png-dosyasi"));
    expect(a.kind).toBe("image");
    const id = await createRequest(ctx, buyer, { media_ids: [b.id, a.id] });

    const det = (await ctx.app.inject({ url: `/api/requests/${id}` })).json();
    expect(det.request.media.map((m: { id: string }) => m.id)).toEqual([b.id, a.id]);
    const file = await ctx.app.inject({ url: det.request.media[1].url });
    expect(file.statusCode).toBe(200);
    expect(file.headers["content-type"]).toBe("image/jpeg");
    expect(file.rawPayload.equals(JPG)).toBe(true);

    const list = (await ctx.app.inject({ url: "/api/requests" })).json();
    expect(list.items[0].cover_url).toBe(det.request.media[0].url);
    expect(list.items[0].media_count).toBe(2);
    expect(list.items[0]).not.toHaveProperty("cover_key");
  });

  it("izin verilmeyen tür ve büyük dosya reddedilir", async () => {
    const u = await login(ctx, "05321112233");
    const pdf = await ctx.app.inject({ method: "POST", url: "/api/media/uploads", headers: { cookie: u }, payload: { content_type: "application/pdf", size: 100 } });
    expect(pdf.statusCode).toBe(400);
    const big = await ctx.app.inject({ method: "POST", url: "/api/media/uploads", headers: { cookie: u }, payload: { content_type: "image/jpeg", size: 11 * 1024 * 1024 } });
    expect(big.statusCode).toBe(400);
    expect(big.json().message).toContain("10 MB");
    const vid = await ctx.app.inject({ method: "POST", url: "/api/media/uploads", headers: { cookie: u }, payload: { content_type: "video/mp4", size: 50 * 1024 * 1024 } });
    expect(vid.statusCode).toBe(201);
    const anon = await ctx.app.inject({ method: "POST", url: "/api/media/uploads", payload: { content_type: "image/jpeg", size: 100 } });
    expect(anon.statusCode).toBe(401);
  });

  it("beyan edilenden farklı dosya yüklenemez; yüklenmeden tamamlanamaz", async () => {
    const u = await login(ctx, "05321112233");
    const t = (await ctx.app.inject({ method: "POST", url: "/api/media/uploads", headers: { cookie: u }, payload: { content_type: "image/jpeg", size: 10 } })).json();
    const early = await ctx.app.inject({ method: "POST", url: `/api/media/${t.id}/complete`, headers: { cookie: u } });
    expect(early.statusCode).toBe(400);
    const wrongSize = await ctx.app.inject({ method: "PUT", url: t.upload.url, headers: { "content-type": "image/jpeg" }, payload: Buffer.alloc(99) });
    expect(wrongSize.statusCode).toBe(403);
    const wrongType = await ctx.app.inject({ method: "PUT", url: t.upload.url, headers: { "content-type": "image/png" }, payload: Buffer.alloc(10) });
    expect(wrongType.statusCode).toBe(403);
    const forged = await ctx.app.inject({ method: "PUT", url: t.upload.url.replace(/t=[^&]+/, "t=sahte"), headers: { "content-type": "image/jpeg" }, payload: Buffer.alloc(10) });
    expect(forged.statusCode).toBe(403);
  });

  it("başkasının dosyası eklenemez, aynı dosya iki yere eklenemez, en fazla 1 video", async () => {
    const buyer = await login(ctx, "05321112233");
    const other = await login(ctx, "05321112244");
    const mine = await upload(ctx, buyer);
    const theirs = await upload(ctx, other);
    const bad = await ctx.app.inject({ method: "POST", url: "/api/requests", headers: { cookie: buyer }, payload: { ...sampleRequest, media_ids: [theirs.id] } });
    expect(bad.statusCode).toBe(400);
    // Hata olunca talep de açılmamalı (tek işlem).
    expect((await ctx.pool.query("SELECT count(*)::int AS n FROM requests")).rows[0].n).toBe(0);

    await createRequest(ctx, buyer, { media_ids: [mine.id] });
    const twice = await ctx.app.inject({ method: "POST", url: "/api/requests", headers: { cookie: buyer }, payload: { ...sampleRequest, media_ids: [mine.id] } });
    expect(twice.statusCode).toBe(400);

    const v1 = await upload(ctx, buyer, "video/mp4", Buffer.from("video-1"));
    const v2 = await upload(ctx, buyer, "video/webm", Buffer.from("video-2"));
    const two = await ctx.app.inject({ method: "POST", url: "/api/requests", headers: { cookie: buyer }, payload: { ...sampleRequest, media_ids: [v1.id, v2.id] } });
    expect(two.statusCode).toBe(400);
    expect(two.json().message).toContain("1 video");
  });

  it("satıcının teklif fotoğraflarını yalnızca alıcı (ve satıcının kendisi) görür", async () => {
    const buyer = await login(ctx, "05321112233");
    const seller = await login(ctx, "05321112244");
    const rival = await login(ctx, "05321112255");
    const id = await createRequest(ctx, buyer);
    const p = await upload(ctx, seller);
    const v = await upload(ctx, seller, "video/quicktime", Buffer.from("mov"));
    const r = await ctx.app.inject({ method: "POST", url: `/api/requests/${id}/offers`, headers: { cookie: seller }, payload: offer([p.id, v.id]) });
    expect(r.statusCode, r.body).toBe(201);

    const asBuyer = (await ctx.app.inject({ url: `/api/requests/${id}`, headers: { cookie: buyer } })).json();
    expect(asBuyer.offers[0].media.map((m: { kind: string }) => m.kind)).toEqual(["image", "video"]);
    const asSeller = (await ctx.app.inject({ url: `/api/requests/${id}`, headers: { cookie: seller } })).json();
    expect(asSeller.offers[0].media).toHaveLength(2);
    const asRival = (await ctx.app.inject({ url: `/api/requests/${id}`, headers: { cookie: rival } })).json();
    expect(asRival.offers).toHaveLength(0);
    expect(asRival.request.media).toHaveLength(0);
  });

  it("eklenmemiş dosya silinebilir, eklenmiş dosya silinemez", async () => {
    const u = await login(ctx, "05321112233");
    const a = await upload(ctx, u);
    const b = await upload(ctx, u);
    await createRequest(ctx, u, { media_ids: [b.id] });
    expect((await ctx.app.inject({ method: "DELETE", url: `/api/media/${a.id}`, headers: { cookie: u } })).statusCode).toBe(200);
    expect((await ctx.app.inject({ url: a.url })).statusCode).toBe(404);
    expect((await ctx.app.inject({ method: "DELETE", url: `/api/media/${b.id}`, headers: { cookie: u } })).statusCode).toBe(404);
  });

  it("uygunsuz görsel: talep incelemeye düşer, teklif reddedilir", async () => {
    class StrictAi extends HeuristicAi {
      override async moderateImages(urls: string[]) { return urls.length ? { verdict: "reject" as const, reason: "Uygunsuz görsel" } : { verdict: "ok" as const, reason: "" }; }
    }
    const c = await makeApp({ ai: new StrictAi() });
    const buyer = await login(c, "05321112233");
    const seller = await login(c, "05321112244");
    const m = await upload(c, buyer);
    const r = await c.app.inject({ method: "POST", url: "/api/requests", headers: { cookie: buyer }, payload: { ...sampleRequest, media_ids: [m.id] } });
    expect(r.json().status).toBe("pending_review");
    // Yönetici incelemede fotoğrafı görür.
    const admin = await login(c, "yonetici@almakisterim.com");
    const mod = (await c.app.inject({ url: "/api/admin/moderation", headers: { cookie: admin } })).json();
    expect(mod.pending[0].media.map((x: { id: string }) => x.id)).toEqual([m.id]);
    const clean = await createRequest(c, buyer);
    const sm = await upload(c, seller);
    const o = await c.app.inject({ method: "POST", url: `/api/requests/${clean}/offers`, headers: { cookie: seller }, payload: offer([sm.id]) });
    expect(o.statusCode).toBe(400);
    expect(o.json().error).toBe("uygunsuz_gorsel");
    // Teklif verilemediği için ücretsiz hak da harcanmamalı.
    expect((await c.pool.query("SELECT count(*)::int AS n FROM offers")).rows[0].n).toBe(0);
    await c.app.close(); await c.pool.end();
  });

  it("depo ayarlanmamışsa yükleme kapalıdır", async () => {
    const c = await makeApp({ storage: disabledStorage });
    const u = await login(c, "05321112233");
    const r = await c.app.inject({ method: "POST", url: "/api/media/uploads", headers: { cookie: u }, payload: { content_type: "image/jpeg", size: 100 } });
    expect(r.statusCode).toBe(503);
    await c.app.close(); await c.pool.end();
  });

  it("zamanlanmış görev bir günden eski, eklenmemiş dosyaları temizler", async () => {
    const u = await login(ctx, "05321112233");
    const old = await upload(ctx, u);
    const fresh = await upload(ctx, u);
    await ctx.pool.query("UPDATE media SET created_at = now() - interval '2 days' WHERE id = $1", [old.id]);
    const r = await ctx.app.inject({ method: "POST", url: "/api/jobs/expire", headers: { "x-job-token": "test-job-token-123" } });
    expect(r.json().media_removed).toBe(1);
    expect((await ctx.app.inject({ url: old.url })).statusCode).toBe(404);
    expect((await ctx.app.inject({ url: fresh.url })).statusCode).toBe(200);
  });
});
