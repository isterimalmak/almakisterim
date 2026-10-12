import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { AiService } from "../src/services/ai.js";
import { createRequest, login, makeApp, resetData, sampleRequest, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
beforeEach(async () => {
  ctx ??= await makeApp();
  await resetData(ctx.pool);
});
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });

describe("kategoriler", () => {
  it("ağaç yapısında döner ve gizlenen kategori listede yer almaz", async () => {
    let r = await ctx.app.inject({ url: "/api/categories" });
    const tops = r.json().categories;
    expect(tops).toHaveLength(12);
    expect(tops.find((t: { id: string }) => t.id === "elektronik").subs.map((s: { id: string }) => s.id)).toContain("telefon");

    await ctx.pool.query("UPDATE categories SET is_visible = false WHERE id IN ('emlak', 'tablet')");
    r = await ctx.app.inject({ url: "/api/categories" });
    const ids = r.json().categories.flatMap((t: { id: string; subs: { id: string }[] }) => [t.id, ...t.subs.map((s) => s.id)]);
    expect(ids).not.toContain("emlak");
    expect(ids).not.toContain("kiralik");
    expect(ids).not.toContain("tablet");
    expect(ids).toContain("telefon");
  });
});

describe("talepler", () => {
  it("giriş yapmadan talep açılamaz", async () => {
    const r = await ctx.app.inject({ method: "POST", url: "/api/requests", payload: sampleRequest });
    expect(r.statusCode).toBe(401);
  });

  it("talep açılır, Talep No 1048200'den başlar ve listede görünür", async () => {
    const cookie = await login(ctx, "05321112233", "Elif Sönmez");
    const id = await createRequest(ctx, cookie);
    expect(id).toBe(1048200);
    const list = await ctx.app.inject({ url: "/api/requests" });
    expect(list.json().total).toBe(1);
    const item = list.json().items[0];
    expect(item).toMatchObject({ id, title: sampleRequest.title, top_id: "elektronik", buyer_name: "Elif S.", offer_count: 0 });
    expect(item.buyer_id).toBeUndefined();
  });

  it("metindeki telefon ve e-posta gizlenir", async () => {
    const cookie = await login(ctx, "05321112233");
    const id = await createRequest(ctx, cookie, { description: "Beni 0532 999 88 77 numarasından veya ali@ornek.com adresinden arayın" });
    const r = await ctx.app.inject({ url: `/api/requests/${id}` });
    const d = r.json().request.description;
    expect(d).not.toContain("999");
    expect(d).not.toContain("ali@ornek.com");
    expect(d).toContain("[numara gizlendi]");
  });

  it("şüpheli içerik incelemeye düşer ve herkese görünmez", async () => {
    const cookie = await login(ctx, "05321112233");
    const r = await ctx.app.inject({ method: "POST", url: "/api/requests", headers: { cookie }, payload: { ...sampleRequest, title: "Sahte ehliyet almak istiyorum" } });
    expect(r.json().status).toBe("pending_review");
    expect((await ctx.app.inject({ url: "/api/requests" })).json().total).toBe(0);
    expect((await ctx.app.inject({ url: `/api/requests/${r.json().id}` })).statusCode).toBe(404);
    expect((await ctx.app.inject({ url: `/api/requests/${r.json().id}`, headers: { cookie } })).statusCode).toBe(200);
  });

  it("gizli kategoriye talep açılamaz, var olan talepleri de listeden çıkar", async () => {
    const cookie = await login(ctx, "05321112233");
    const id = await createRequest(ctx, cookie);
    await ctx.pool.query("UPDATE categories SET is_visible = false WHERE id = 'elektronik'");
    expect((await ctx.app.inject({ url: "/api/requests" })).json().total).toBe(0);
    expect((await ctx.app.inject({ url: `/api/requests/${id}` })).statusCode).toBe(404);
    const r = await ctx.app.inject({ method: "POST", url: "/api/requests", headers: { cookie }, payload: sampleRequest });
    expect(r.statusCode).toBe(400);
  });

  it("geçersiz bütçe ve il reddedilir", async () => {
    const cookie = await login(ctx, "05321112233");
    const a = await ctx.app.inject({ method: "POST", url: "/api/requests", headers: { cookie }, payload: { ...sampleRequest, budget_min: 30000 } });
    expect(a.statusCode).toBe(400);
    const b = await ctx.app.inject({ method: "POST", url: "/api/requests", headers: { cookie }, payload: { ...sampleRequest, city: "Atlantis" } });
    expect(b.statusCode).toBe(400);
  });

  it("filtreler ve sıralama çalışır", async () => {
    const cookie = await login(ctx, "05321112233");
    await createRequest(ctx, cookie);
    await createRequest(ctx, cookie, { category_id: "otomobil", title: "Otomatik dizel Passat", budget_min: 1000000, budget_max: 1400000, city: "Ankara", is_urgent: false, attrs: { marka: "Volkswagen" } });
    await createRequest(ctx, cookie, { category_id: "kiralik", title: "Bornova 1+1 kiralık", budget_min: 12000, budget_max: 16000, city: "İzmir", condition: "Farketmez", attrs: {} });
    const get = async (qs: string) => (await ctx.app.inject({ url: `/api/requests?${qs}` })).json();
    expect((await get("top=vasita")).total).toBe(1);
    expect((await get("sub=kiralik")).items[0].title).toBe("Bornova 1+1 kiralık");
    expect((await get(`city=${encodeURIComponent("İzmir")}`)).total).toBe(1);
    expect((await get("urgent=1")).total).toBe(2);
    expect((await get("q=passat")).total).toBe(1);
    expect((await get("a_marka=Apple,Samsung")).total).toBe(1);
    expect((await get("bmin=100000")).total).toBe(1);
    expect((await get("sort=budget_desc")).items[0].title).toBe("Otomatik dizel Passat");
    expect((await get("q=1048201")).items[0].title).toBe("Otomatik dizel Passat");
    expect((await get("per=2&page=2")).items).toHaveLength(1);
  });

  it("yapay zekâ taslağı kategori, bütçe ve ili doldurur, numarayı gizler", async () => {
    const r = await ctx.app.inject({ method: "POST", url: "/api/ai/draft", payload: { text: "2. el iPhone 13 almak istiyorum, bütçem 20.000 TL, İstanbul. Numaram 0532 111 22 33" } });
    const { draft, contacts_masked } = r.json();
    expect(draft).toMatchObject({ category_id: "telefon", budget_max: 20000, city: "İstanbul", condition: "İkinci El" });
    expect(draft.description).not.toContain("111 22 33");
    expect(contacts_masked).toBe(true);
  });

  it("yapay zekâ listede olmayan kategori uydurursa sunucu kabul etmez", async () => {
    const lying: AiService = {
      draftRequest: async () => ({ category_id: "uydurma", title: "x", budget_min: null, budget_max: null, city: null, condition: "Farketmez", is_urgent: false, attrs: {} }),
      moderate: async () => ({ verdict: "ok", reason: "" }),
    };
    const app2 = await makeApp({ ai: lying });
    const cookie = await login(app2, "05321112233");
    const r = await app2.app.inject({ method: "POST", url: "/api/requests", headers: { cookie }, payload: { ...sampleRequest, category_id: "uydurma" } });
    expect(r.statusCode).toBe(400);
    await app2.app.close(); await app2.pool.end();
  });

  it("talep sahibi talebini kapatabilir, başkası kapatamaz", async () => {
    const a = await login(ctx, "05321112233");
    const b = await login(ctx, "05321112244");
    const id = await createRequest(ctx, a);
    expect((await ctx.app.inject({ method: "POST", url: `/api/requests/${id}/close`, headers: { cookie: b } })).statusCode).toBe(404);
    expect((await ctx.app.inject({ method: "POST", url: `/api/requests/${id}/close`, headers: { cookie: a } })).statusCode).toBe(200);
    expect((await ctx.app.inject({ url: "/api/requests" })).json().total).toBe(0);
  });
});


describe("hatalı adresler", () => {
  it("geçersiz Talep No 404 ve Türkçe mesaj döner", async () => {
    const r = await ctx.app.inject({ url: "/api/requests/undefined" });
    expect(r.statusCode).toBe(404);
    expect(r.json().message).toBe("Aradığınız kayıt bulunamadı.");
  });
  it("doğrulama hataları Türkçe döner", async () => {
    const r = await ctx.app.inject({ method: "POST", url: "/api/auth/code", payload: { channel: "faks", target: "x" } });
    expect(r.statusCode).toBe(400);
    expect(r.json().message).toMatch(/[ğüşıöçĞÜŞİÖÇ]|Geçersiz/);
  });
});
