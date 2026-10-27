import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LEGAL_DOCS } from "../src/data/legal/index.js";
import { createRequest, login, makeApp, resetData, sampleRequest, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
beforeAll(async () => { ctx = await makeApp(); await resetData(ctx.pool); });
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });
const get = (url: string, cookie?: string) => ctx.app.inject({ url: `/api${url}`, headers: cookie ? { cookie } : {} });
const post = (url: string, cookie: string, payload: unknown, headers: Record<string, string> = {}) =>
  ctx.app.inject({ method: "POST", url: `/api${url}`, headers: { cookie, ...headers }, payload: payload as object });

describe("sözleşmeler ve onay kayıtları", () => {
  it("bütün metinler yayında; adres, sürüm ve başlıklar tekil; yer tutucular doldurulur", async () => {
    const list = (await get("/legal")).json();
    expect(list.items.map((d: { slug: string }) => d.slug)).toEqual(LEGAL_DOCS.map((d) => d.slug));
    expect(new Set(LEGAL_DOCS.map((d) => d.slug)).size).toBe(LEGAL_DOCS.length);
    expect(list.terms).toEqual({ slug: "uyelik-sozlesmesi", version: "1.0" });
    for (const d of LEGAL_DOCS) {
      const doc = (await get(`/legal/${d.slug}`)).json().doc;
      const text = JSON.stringify(doc.sections);
      expect(text, d.slug).not.toMatch(/\{\{[A-Z_]+\}\}/);
      expect(doc.sections.length, d.slug).toBeGreaterThan(0);
    }
    // Şirket bilgisi girilmeden köşeli parantezle görünür; Güvenli Al oranları ayarlardan gelir.
    const ga = JSON.stringify((await get("/legal/guvenli-al-sozlesmesi")).json().doc);
    expect(ga).toContain("[Şirket unvanı]");
    expect(ga).toContain("%5 oranında, en az 25 TL ve en fazla 2.500 TL");
    expect((await get("/legal/yok")).statusCode).toBe(404);
  });

  it("yönetici şirket bilgilerini girer, metinlere yansır; üye giremez", async () => {
    const admin = await login(ctx, "yonetici@almakisterim.com", "Yönetici");
    const user = await login(ctx, "05321113001", "Ali Veli");
    const body = { unvan: "Almak İsterim Teknoloji A.Ş.", adres: "Moda Cad. No: 1 Kadıköy/İstanbul", mersis: "0123456789000015", eposta: "destek@almakisterim.com" };
    expect((await ctx.app.inject({ method: "PUT", url: "/api/admin/legal-info", headers: { cookie: user }, payload: body })).statusCode).toBe(403);
    expect((await ctx.app.inject({ method: "PUT", url: "/api/admin/legal-info", headers: { cookie: admin }, payload: { ...body, bilinmeyen: "x" } })).statusCode).toBe(400);
    expect((await ctx.app.inject({ method: "PUT", url: "/api/admin/legal-info", headers: { cookie: admin }, payload: body })).statusCode).toBe(200);
    const text = JSON.stringify((await get("/legal/uyelik-sozlesmesi")).json().doc);
    expect(text).toContain("Almak İsterim Teknoloji A.Ş.");
    expect(text).toContain("0123456789000015");
    expect(text).toContain("[KEP adresi]");
  });

  it("sözleşmeyi onaylamayan üye talep veremez, numara açamaz; onay sürüm, IP ve tarayıcıyla kaydedilir", async () => {
    const buyer = await login(ctx, "05321113002", "Elif Sönmez", { terms: false });
    expect((await get("/me", buyer)).json().user.terms_ok).toBe(false);
    const r = await post("/requests", buyer, { ...sampleRequest, phone_code: undefined });
    expect(r.statusCode).toBe(428);
    expect(r.json().error).toBe("sozlesme_onayi_gerekli");

    const ok = await post("/me/consents", buyer, { terms: true, context: "giris" }, { "user-agent": "Test Tarayıcı", "cf-connecting-ip": "203.0.113.7" });
    expect(ok.json()).toEqual({ terms_ok: true });
    expect((await get("/me", buyer)).json().user.terms_ok).toBe(true);
    const id = await createRequest(ctx, buyer);

    // Talep verilirken telefon paylaşımı açık rızası talep numarasıyla kaydedilir.
    const rows = (await ctx.pool.query("SELECT doc, version, context, ip, user_agent, granted FROM consents WHERE user_id = (SELECT id FROM users WHERE phone = '905321113002') ORDER BY id")).rows;
    expect(rows[0]).toMatchObject({ doc: "uyelik-sozlesmesi", version: "1.0", context: "giris", ip: "203.0.113.7", user_agent: "Test Tarayıcı", granted: true });
    expect(rows[1]).toMatchObject({ doc: "acik-riza-metni", context: `talep:${id}` });

    const seller = await login(ctx, "05321113003", "Can Yıldız", { terms: false });
    expect((await post(`/requests/${id}/unlock`, seller, {})).statusCode).toBe(428);
    await post("/me/consents", seller, { terms: true });
    expect((await post(`/requests/${id}/unlock`, seller, {})).statusCode).toBe(201);
  });

  it("ticari ileti onayı ve geri alınması kaydedilir; üye ve yönetici onay geçmişini görür", async () => {
    const cookie = await login(ctx, "05321113004", "Ayşe Kaya");
    await post("/me/consents", cookie, { marketing: true, context: "giris" });
    expect((await get("/me", cookie)).json().user.marketing).toBe(true);
    await ctx.app.inject({ method: "PATCH", url: "/api/me", headers: { cookie }, payload: { marketing: false } });
    expect((await get("/me", cookie)).json().user.marketing).toBe(false);
    const mine = (await get("/me/consents", cookie)).json().items;
    expect(mine.map((x: { doc: string; granted: boolean }) => `${x.doc}:${x.granted}`)).toEqual([
      "ticari-elektronik-ileti-onayi:false", "ticari-elektronik-ileti-onayi:true", "uyelik-sozlesmesi:true"]);
    expect(mine[0].title).toBe("Ticari Elektronik İleti Onay Metni");

    const admin = await login(ctx, "yonetici@almakisterim.com", "Yönetici");
    const uid = (await ctx.pool.query("SELECT id FROM users WHERE phone = '905321113004'")).rows[0].id;
    const all = (await get(`/admin/users/${uid}/consents`, admin)).json().items;
    expect(all).toHaveLength(3);
    expect((await get(`/admin/users/${uid}/consents`, cookie)).statusCode).toBe(403);
  });
});
