import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Pexels, queriesFor } from "../src/services/pexels.js";
import { createRequest, login, makeApp, resetData, type TestCtx } from "./helpers.js";

// Pexels'e gerçek istek atılmaz: arama, fotoğraf bilgisi ve indirme sahte cevaplarla döner.
const calls: string[] = [];
const photo = (id: number, alt: string) => ({ id, url: `https://www.pexels.com/photo/${id}/`, alt, photographer: "Ayşe K.", photographer_url: "https://www.pexels.com/@ayse",
  src: { large: `https://images.pexels.com/photos/${id}/large.jpeg`, medium: `https://images.pexels.com/photos/${id}/medium.jpeg` } });
const fakeFetch = (async (input: string | URL) => {
  const u = String(input);
  calls.push(u);
  if (u.startsWith("https://api.pexels.com/v1/search")) {
    const q = new URL(u).searchParams.get("query")!;
    return new Response(JSON.stringify({ photos: q.includes("BMW") ? [photo(11, "white bmw"), photo(12, "blue bmw")] : [photo(21, "car")] }), { status: 200 });
  }
  if (u === "https://api.pexels.com/v1/photos/11") return new Response(JSON.stringify(photo(11, "white bmw")), { status: 200 });
  if (u.startsWith("https://api.pexels.com/v1/photos/")) return new Response("{}", { status: 404 });
  if (u.startsWith("https://images.pexels.com/")) return new Response(Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]), { status: 200, headers: { "content-type": "image/jpeg" } });
  return new Response("", { status: 500 });
}) as unknown as typeof fetch;

let ctx: TestCtx;
beforeEach(async () => {
  ctx ??= await makeApp({ photos: new Pexels("test-key", fakeFetch) });
  await resetData(ctx.pool);
  calls.length = 0;
});
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });

describe("Pexels stok fotoğrafları", () => {
  it("araç talebine göre İngilizce arama yapılır", () => {
    expect(queriesFor("otomobil", [{ marka: "BMW", model: "3 Serisi" }, { marka: "Mercedes-Benz", model: "C Serisi" }, { marka: "Audi", model: "" }]))
      .toEqual(["BMW 3 Series", "Mercedes-Benz C-Class", "Audi car"]);
    expect(queriesFor("satilik", [])).toEqual(["apartment interior living room"]);
  });

  it("galeride uygun görsel yoksa Pexels sonuçları gelir; seçilen fotoğraf kendi depomuza kopyalanıp talebe eklenir", async () => {
    const r = (await ctx.app.inject({ url: `/api/stock-images?category=otomobil&araclar=${encodeURIComponent("BMW:3 Serisi")}` })).json();
    expect(r.photos.map((p: { id: number }) => p.id)).toEqual([11, 12]);
    expect(r.photos[0]).toMatchObject({ photographer: "Ayşe K.", thumb: expect.stringContaining("images.pexels.com") });
    expect(r.photo_source).toEqual({ name: "Pexels", url: "https://www.pexels.com" });
    expect(calls.some((c) => c.includes("BMW+3+Series"))).toBe(true);

    // İkinci arama önbellekten gelir.
    calls.length = 0;
    await ctx.app.inject({ url: `/api/stock-images?category=otomobil&araclar=${encodeURIComponent("BMW:3 Serisi")}` });
    expect(calls).toHaveLength(0);

    const buyer = await login(ctx, "05321112233");
    const used = await ctx.app.inject({ method: "POST", url: "/api/stock-images/photos/11/use", headers: { cookie: buyer } });
    expect(used.statusCode, used.body).toBe(201);
    expect(used.json().url).toMatch(/^\/api\/__media\/file\/image\//);
    expect((await ctx.app.inject({ url: used.json().url })).statusCode).toBe(200);
    const id = await createRequest(ctx, buyer, { media_ids: [used.json().id] });
    expect((await ctx.app.inject({ url: `/api/requests/${id}` })).json().request.media).toHaveLength(1);

    expect((await ctx.app.inject({ method: "POST", url: "/api/stock-images/photos/99/use", headers: { cookie: buyer } })).statusCode).toBe(404);
    expect((await ctx.app.inject({ method: "POST", url: "/api/stock-images/photos/11/use" })).statusCode).toBe(401);
  });
});
