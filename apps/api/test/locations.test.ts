import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { findDistrictInText } from "../src/data/locations.js";
import { createRequest, login, makeApp, resetData, sampleRequest, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
beforeEach(async () => {
  ctx ??= await makeApp();
  await resetData(ctx.pool);
});
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });

const titles = async (qs: string) => (await ctx.app.inject({ url: `/api/requests?${qs}` })).json().items.map((r: { title: string }) => r.title).sort();

describe("il, ilçe ve mahalle", () => {
  it("il seçilince ilçeler, ilçe seçilince mahalleler gelir", async () => {
    const d = (await ctx.app.inject({ url: `/api/locations?il=${encodeURIComponent("İstanbul")}` })).json().districts;
    expect(d).toContain("Kadıköy");
    expect(d).toHaveLength(39);
    const m = (await ctx.app.inject({ url: `/api/locations?il=${encodeURIComponent("İstanbul")}&ilce=${encodeURIComponent("kadıköy")}` })).json().neighbourhoods;
    expect(m).toEqual(expect.arrayContaining(["Caferağa", "Koşuyolu", "Fenerbahçe"]));
    expect((await ctx.app.inject({ url: "/api/locations?il=Yok" })).statusCode).toBe(404);
  });

  it("talep ilçe/mahalleyle kaydedilir; yazım listedekine çevrilir, olmayan reddedilir", async () => {
    const u = await login(ctx, "05321112233");
    const id = await createRequest(ctx, u, { city: "İstanbul", district: "kadıköy", neighbourhood: "caferağa mahallesi" });
    const r = (await ctx.app.inject({ url: `/api/requests/${id}` })).json().request;
    expect(r).toMatchObject({ city: "İstanbul", district: "Kadıköy", neighbourhood: "Caferağa" });
    const bad = await ctx.app.inject({ method: "POST", url: "/api/requests", headers: { cookie: u }, payload: { ...sampleRequest, city: "İstanbul", district: "Çankaya" } });
    expect(bad.json().error).toBe("ilce_gecersiz");
  });

  it("satıcı il → ilçe → mahalle ile arar; ilçe 'farketmez' diyen alıcılar da çıkar", async () => {
    const u = await login(ctx, "05321112233");
    await createRequest(ctx, u, { title: "A Kadıköy Koşuyolu", city: "İstanbul", district: "Kadıköy", neighbourhood: "Koşuyolu" });
    await createRequest(ctx, u, { title: "B Kadıköy her yer", city: "İstanbul", district: "Kadıköy" });
    await createRequest(ctx, u, { title: "C Üsküdar", city: "İstanbul", district: "Üsküdar" });
    await createRequest(ctx, u, { title: "D İstanbul farketmez", city: "İstanbul" });
    await createRequest(ctx, u, { title: "E Urfa", city: "Şanlıurfa", district: "Haliliye" });
    const il = encodeURIComponent("İstanbul"), ilce = encodeURIComponent("Kadıköy");
    expect(await titles(`city=${il}`)).toEqual(["A Kadıköy Koşuyolu", "B Kadıköy her yer", "C Üsküdar", "D İstanbul farketmez"]);
    expect(await titles(`city=${il}&district=${ilce}`)).toEqual(["A Kadıköy Koşuyolu", "B Kadıköy her yer", "D İstanbul farketmez"]);
    expect(await titles(`city=${il}&district=${ilce}&neighbourhood=Caferağa`)).toEqual(["B Kadıköy her yer", "D İstanbul farketmez"]);
  });

  it("yapay zekâ taslağı metindeki ilçeyi ve ilini bulur", async () => {
    const d = (await ctx.app.inject({ method: "POST", url: "/api/ai/draft", payload: { text: "Kadıköy'de 3+1 satılık ev arıyorum, bütçem 8 milyon TL" } })).json().draft;
    expect(d).toMatchObject({ city: "İstanbul", district: "Kadıköy" });
    expect(findDistrictInText("ankara çankayada daire", "Ankara")).toEqual({ city: "Ankara", district: "Çankaya" });
    expect(findDistrictInText("kadıköylü bir arkadaş", null)).toBeNull();
  });
});
