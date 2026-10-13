import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Pixabay } from "../src/services/pixabay.js";
import { createRequest, login, makeApp, resetData, sampleRequest, type TestCtx } from "./helpers.js";

// Pixabay'e gerçek istek atılmaz: arama, fotoğraf bilgisi ve indirme sahte cevaplarla döner.
const calls: string[] = [];
const hit = (id: number, tags: string) => ({ id, pageURL: `https://pixabay.com/photos/${id}/`, tags, user: "mehmet", user_id: 7,
  webformatURL: `https://pixabay.com/get/${id}_640.jpg`, largeImageURL: `https://pixabay.com/get/${id}_1280.jpg` });
const fakeFetch = (async (input: string | URL) => {
  const u = new URL(String(input));
  calls.push(String(input));
  if (u.hostname === "pixabay.com" && u.pathname === "/api/") {
    if (u.searchParams.get("key") !== "test-key") return new Response("[ERROR 400] Invalid or missing API key", { status: 400 });
    const id = u.searchParams.get("id");
    if (id) return id === "31" ? new Response(JSON.stringify({ hits: [hit(31, "bmw, car")] }), { status: 200 }) : new Response("[ERROR 400] \"id\" is out of valid range.", { status: 400 });
    const q = u.searchParams.get("q")!;
    return new Response(JSON.stringify({ hits: q.includes("BMW") ? [hit(31, "bmw, car"), hit(32, "bmw, white")] : [hit(41, "car")] }), { status: 200 });
  }
  if (u.hostname === "pixabay.com" && u.pathname.startsWith("/get/")) return new Response(Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]), { status: 200, headers: { "content-type": "image/jpeg" } });
  return new Response("", { status: 500 });
}) as unknown as typeof fetch;

let ctx: TestCtx;
beforeEach(async () => {
  ctx ??= await makeApp({ photos: new Pixabay("test-key", fakeFetch) });
  await resetData(ctx.pool);
  calls.length = 0;
});
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });

describe("Pixabay stok fotoğrafları", () => {
  it("talebe uyan Pixabay fotoğrafları gelir; seçilen kendi depomuza kopyalanıp talebe eklenir", async () => {
    const r = (await ctx.app.inject({ url: `/api/stock-images?category=otomobil&araclar=${encodeURIComponent("BMW:3 Serisi")}` })).json();
    expect(r.photos.map((p: { id: number }) => p.id)).toEqual([31, 32]);
    expect(r.photos[0]).toMatchObject({ photographer: "mehmet", photographer_url: "https://pixabay.com/users/mehmet-7/" });
    expect(r.photo_source).toEqual({ name: "Pixabay", url: "https://pixabay.com" });
    // Anahtar sunucuda kalır, tarayıcıya giden cevapta yoktur.
    expect(JSON.stringify(r)).not.toContain("test-key");
    expect(calls.some((c) => c.includes("q=BMW+3+Series"))).toBe(true);

    const buyer = await login(ctx, "05321112244");
    const used = await ctx.app.inject({ method: "POST", url: "/api/stock-images/photos/31/use", headers: { cookie: buyer } });
    expect(used.statusCode, used.body).toBe(201);
    expect((await ctx.app.inject({ url: used.json().url })).statusCode).toBe(200);
    const id = await createRequest(ctx, buyer, { media_ids: [used.json().id] });
    expect((await ctx.app.inject({ url: `/api/requests/${id}` })).json().request.media).toHaveLength(1);

    expect((await ctx.app.inject({ method: "POST", url: "/api/stock-images/photos/99/use", headers: { cookie: buyer } })).statusCode).toBe(404);
  });

  it("anahtar hatalıysa arama boş döner, seçim hata verir (site çökmez)", async () => {
    const bad = await makeApp({ photos: new Pixabay("yanlis", fakeFetch) });
    try {
      const r = (await bad.app.inject({ url: "/api/stock-images?category=otomobil" })).json();
      expect(r.photos).toEqual([]);
      const buyer = await login(bad, "05321112255");
      expect((await bad.app.inject({ method: "POST", url: "/api/stock-images/photos/31/use", headers: { cookie: buyer } })).statusCode).toBe(502);
    } finally { await bad.app.close(); await bad.pool.end(); }
  });

  it("fotoğraf zorunluyken fotoğrafsız talep yayınlanamaz; hazır görselle yayınlanır; yönetimden kapatılabilir", async () => {
    await ctx.pool.query("UPDATE settings SET value = 'true' WHERE key = 'photo_required'");
    expect((await ctx.app.inject({ url: "/api/categories" })).json().photo_required).toBe(true);
    const buyer = await login(ctx, "05321112266");
    const no = await ctx.app.inject({ method: "POST", url: "/api/requests", headers: { cookie: buyer }, payload: sampleRequest });
    expect(no.statusCode).toBe(400);
    expect(no.json().error).toBe("fotograf_gerekli");
    const used = (await ctx.app.inject({ method: "POST", url: "/api/stock-images/photos/31/use", headers: { cookie: buyer } })).json();
    expect(await createRequest(ctx, buyer, { media_ids: [used.id] })).toBeGreaterThan(0);

    await ctx.pool.query("UPDATE settings SET value = 'false' WHERE key = 'photo_required'");
    expect((await ctx.app.inject({ url: "/api/categories" })).json().photo_required).toBe(false);
    expect(await createRequest(ctx, buyer)).toBeGreaterThan(0);
  });
});
