import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { versionCmp } from "../src/modules/legal.js";
import { login, makeApp, resetData, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
beforeAll(async () => { ctx = await makeApp(); await resetData(ctx.pool); });
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });
const call = (method: "GET" | "PUT" | "POST" | "DELETE", url: string, cookie?: string, payload?: unknown) =>
  ctx.app.inject({ method, url: `/api${url}`, headers: cookie ? { cookie } : {}, ...(payload !== undefined ? { payload: payload as object } : {}) });

describe("yönetimden düzenlenen içerik", () => {
  it("alt bilgi: varsayılan gelir; yönetici sütun ve bağlantıları değiştirir; geçersiz bağlantı reddedilir", async () => {
    const def = (await call("GET", "/categories")).json().footer;
    expect(def.columns.map((c: { title: string }) => c.title)).toEqual(["Kurumsal", "Alıcılar İçin", "Satıcılar İçin", "Gizlilik ve Kullanım"]);
    const admin = await login(ctx, "yonetici@almakisterim.com", "Yönetici");
    const user = await login(ctx, "05321114001", "Ali Veli");
    const footer = { columns: [{ title: "Kurumsal", links: [{ label: "Hakkımızda", href: "/sayfa/hakkimizda" }, { label: "Instagram", href: "https://instagram.com/almakisterim" }, { label: "Bize yazın", href: "mailto:destek@almakisterim.com" }] }],
      bottom_left: "© {yıl} almakisterim.com", bottom_right: "Türkiye'nin alım talebi sitesi" };
    expect((await call("PUT", "/admin/footer", user, footer)).statusCode).toBe(403);
    const bad = await call("PUT", "/admin/footer", admin, { ...footer, columns: [{ title: "X", links: [{ label: "Kötü", href: "javascript:alert(1)" }] }] });
    expect(bad.statusCode).toBe(400);
    expect((await call("PUT", "/admin/footer", admin, footer)).statusCode).toBe(200);
    expect((await call("GET", "/categories")).json().footer).toEqual(footer);
  });

  it("sayfalar: Hakkımızda düzenlenir, yeni sayfa eklenir ve silinir; sözleşme adresleri kullanılamaz", async () => {
    const admin = await login(ctx, "yonetici@almakisterim.com", "Yönetici");
    expect((await call("GET", "/pages/hakkimizda")).json().page.title).toBe("Hakkımızda");
    await call("PUT", "/admin/pages/hakkimizda", admin, { title: "Biz Kimiz", body: "## Hikâyemiz\n\nAlıcılar yazar, **satıcılar** bulur." });
    expect((await call("GET", "/pages/hakkimizda")).json().page).toMatchObject({ title: "Biz Kimiz", body: "## Hikâyemiz\n\nAlıcılar yazar, **satıcılar** bulur." });
    expect((await call("PUT", "/admin/pages/nasil-calisir", admin, { title: "Sıkça Sorulan Sorular", body: "- Talep vermek ücretsiz mi? Evet." })).statusCode).toBe(200);
    expect((await call("GET", "/admin/site", admin)).json().pages.map((p: { slug: string }) => p.slug)).toEqual(["hakkimizda", "iletisim", "nasil-calisir"]);
    expect((await call("PUT", "/admin/pages/kvkk", admin, { title: "KVKK", body: "x" })).json().error).toBe("adres_ayrilmis");
    expect((await call("PUT", "/admin/pages/Kötü Adres", admin, { title: "x y", body: "x" })).statusCode).toBe(400);
    await call("DELETE", "/admin/pages/nasil-calisir", admin);
    expect((await call("GET", "/pages/nasil-calisir")).statusCode).toBe(404);
  });

  it("sözleşme düzenleme: küçük düzeltme onayı korur, esaslı değişiklik yeniden onay ister; eski sürüm okunur", async () => {
    expect(versionCmp("1.10", "1.9")).toBeGreaterThan(0);
    expect(versionCmp("2.0", "1.9")).toBeGreaterThan(0);
    const admin = await login(ctx, "yonetici@almakisterim.com", "Yönetici");
    const member = await login(ctx, "05321114002", "Elif Sönmez");
    const ed = (await call("GET", "/admin/legal/uyelik-sozlesmesi", admin)).json();
    expect(ed.doc.version).toBe("1.0");
    expect(JSON.stringify(ed.doc.sections)).toContain("{{UNVAN}}");
    const sections = [...ed.doc.sections, { h: "20. Ek Madde", p: ["Deneme ek maddesi."] }];

    const minor = (await call("PUT", "/admin/legal/uyelik-sozlesmesi", admin, { title: ed.doc.title, summary: ed.doc.summary, sections, change: "kucuk", note: "Yazım düzeltmesi" })).json();
    expect(minor.doc.version).toBe("1.1");
    expect((await call("GET", "/me", member)).json().user.terms_ok).toBe(true);
    expect((await call("GET", "/legal")).json().terms.version).toBe("1.1");

    const major = (await call("PUT", "/admin/legal/uyelik-sozlesmesi", admin, { title: ed.doc.title, summary: ed.doc.summary, sections, change: "esasli", effective: "2026-11-05" })).json();
    expect(major.doc).toMatchObject({ version: "2.0", effective: "2026-11-05" });
    expect(major.versions.map((v: { version: string }) => v.version)).toEqual(["2.0", "1.1", "1.0"]);
    // Esaslı değişiklikten sonra eski onay yetmez; üye yeniden onaylayınca devam eder.
    expect((await call("GET", "/me", member)).json().user.terms_ok).toBe(false);
    expect((await call("POST", "/requests", member, {})).statusCode).toBe(428);
    await call("POST", "/me/consents", member, { terms: true });
    expect((await call("GET", "/me", member)).json().user.terms_ok).toBe(true);
    expect((await ctx.pool.query("SELECT version FROM consents WHERE user_id = (SELECT id FROM users WHERE phone = '905321114002') ORDER BY id DESC LIMIT 1")).rows[0].version).toBe("2.0");

    // Herkes yürürlükteki metni ve eski sürümleri görebilir; yer tutucular doldurulur.
    const now = (await call("GET", "/legal/uyelik-sozlesmesi")).json();
    expect(now.doc.version).toBe("2.0");
    expect(JSON.stringify(now.doc.sections)).toContain("Deneme ek maddesi.");
    const old = (await call("GET", "/legal/uyelik-sozlesmesi?v=1.0")).json().doc;
    expect(old.version).toBe("1.0");
    expect(JSON.stringify(old.sections)).not.toContain("Deneme ek maddesi.");
    expect((await call("GET", "/legal/uyelik-sozlesmesi?v=9.9")).statusCode).toBe(404);

    // Onay gerektirmeyen metinde esaslı değişiklik kimseden onay istemez.
    const c = (await call("GET", "/admin/legal/cerez-politikasi", admin)).json().doc;
    expect((await call("PUT", "/admin/legal/cerez-politikasi", admin, { title: c.title, summary: c.summary, sections: c.sections, change: "esasli" })).json().doc.version).toBe("2.0");
    expect((await call("GET", "/me", member)).json().user.terms_ok).toBe(true);
    expect((await call("PUT", "/admin/legal/cerez-politikasi", admin, { title: c.title, sections: [{ h: "Boş", p: [] }], change: "kucuk" })).statusCode).toBe(400);
    expect((await call("PUT", "/admin/legal/cerez-politikasi", member, { title: c.title, sections: c.sections, change: "kucuk" })).statusCode).toBe(403);
  });
});

describe("Sık Sorulan Sorular ve ödeme bölümlerinin gizlenmesi", () => {
  it("SSS varsayılan sorularla gelir; yönetici düzenler; Güvenli Al ve kredi gizlenince ilgili sorular, bağlantılar ve metinler kaybolur", async () => {
    await resetData(ctx.pool);
    const admin = await login(ctx, "yonetici@almakisterim.com", "Yönetici");
    const groups = (await call("GET", "/faq")).json().items.map((x: { group: string }) => x.group);
    expect(new Set(groups)).toEqual(new Set(["Genel", "Alıcılar", "Satıcılar", "Kredi ve Ücretler", "Güvenli Al", "Hesap ve Gizlilik"]));
    const cats = (await call("GET", "/categories")).json();
    expect(cats).toMatchObject({ show_safe: true, show_credits: true });
    expect(JSON.stringify(cats.footer)).toContain('"/guvenli-al"');
    expect(JSON.stringify(cats.footer)).toContain("/sss");

    // Yönetici ödeme bölümlerini gizler.
    expect((await call("PUT", "/admin/settings", admin, { show_safe: false, show_credits: false })).statusCode).toBe(200);
    const hidden = (await call("GET", "/categories")).json();
    expect(hidden).toMatchObject({ show_safe: false, show_credits: false });
    expect(JSON.stringify(hidden.footer)).not.toContain('"/guvenli-al"');
    expect(JSON.stringify(hidden.footer)).not.toContain("s=kredi");
    const left = (await call("GET", "/faq")).json().items.map((x: { group: string }) => x.group);
    expect(left).not.toContain("Güvenli Al");
    expect(left).not.toContain("Kredi ve Ücretler");
    const docs = (await call("GET", "/legal")).json().items.map((d: { slug: string }) => d.slug);
    expect(docs).not.toContain("guvenli-al-sozlesmesi");
    expect(docs).not.toContain("mesafeli-satis-sozlesmesi");
    expect((await call("GET", "/legal?tum=1")).json().items.map((d: { slug: string }) => d.slug)).toContain("guvenli-al-sozlesmesi");
    // Güvenli Al kapalı görünür ve satış başlatılamaz.
    expect((await call("GET", "/safe/info", admin)).json().enabled).toBe(false);
    expect((await call("POST", "/safe/sales", admin, { request_id: 1, title: "Deneme ürün", price: 100, accept: true })).statusCode).toBe(503);

    // SSS düzenlenir; boş cevap kabul edilmez.
    const items = [{ group: "Genel", q: "Siz kimsiniz?", a: "Alım talebi sitesiyiz." }, { group: "Güvenli Al", q: "Güvenli Al nedir?", a: "Bekletmeli ödeme.", tag: "safe" }];
    expect((await call("PUT", "/admin/faq", admin, [{ group: "Genel", q: "Boş mu?", a: "" }])).statusCode).toBe(400);
    expect((await call("PUT", "/admin/faq", admin, items)).statusCode).toBe(200);
    expect((await call("GET", "/faq")).json().items).toEqual([items[0]]);
    await call("PUT", "/admin/settings", admin, { show_safe: true, show_credits: true });
    expect((await call("GET", "/faq")).json().items).toEqual(items);
  });
});

describe("kurumsal sayfalar", () => {
  it("menü sayfaları ve İletişim'deki şirket bilgileri (yalnızca girilenler)", async () => {
    await resetData(ctx.pool);
    const admin = await login(ctx, "yonetici@almakisterim.com", "Yönetici");
    const pages = (await call("GET", "/pages")).json().items.map((p: { slug: string }) => p.slug);
    expect(pages[0]).toBe("hakkimizda");
    expect(pages.at(-1)).toBe("iletisim");
    expect((await call("GET", "/company")).json().company).toEqual({ marka: "almakisterim.com", eposta: "destek@almakisterim.com" });
    await call("PUT", "/admin/legal-info", admin, { unvan: "Almak İsterim Teknoloji A.Ş.", sicil: "123456", sorumlu: "Ayşe Yılmaz", yetkili_yer: "İstanbul" });
    expect((await call("GET", "/company")).json().company).toEqual({ marka: "almakisterim.com", eposta: "destek@almakisterim.com", unvan: "Almak İsterim Teknoloji A.Ş.", sicil: "123456", sorumlu: "Ayşe Yılmaz" });
  });
});
