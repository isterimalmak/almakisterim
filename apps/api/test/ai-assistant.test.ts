import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { HeuristicAi, tidyText, type AiService, type ListingReview, type TextCheck } from "../src/services/ai.js";
import { createRequest, login, makeApp, resetData, sampleRequest, type TestCtx } from "./helpers.js";

// Gerçek Claude'a istek atılmaz: sahte yapay zekâ ne döndüreceğini testten alır. Kural tabanlı sınıftan türemediği için
// uygulama onu "gerçek" yapay zekâ sayar ve günlük sınırdan geçirir.
class FakeAi implements AiService {
  base = new HeuristicAi();
  calls = 0;
  review: (i: { title: string; description: string }) => ListingReview = (i) => ({ verdict: "ok", reason: "", title: i.title, description: i.description, changes: "" });
  message: (t: string) => TextCheck = () => ({ verdict: "ok", reason: "" });
  draftRequest = this.base.draftRequest.bind(this.base);
  moderate = this.base.moderate.bind(this.base);
  images: (urls: string[]) => { verdict: "ok" | "review" | "reject"; reason: string } = () => ({ verdict: "ok", reason: "" });
  async moderateImages(urls: string[]) { this.calls++; return this.images(urls); }
  async reviewListing(i: { title: string; description: string; category: string }) { this.calls++; return this.review(i); }
  async checkMessage(t: string) { this.calls++; return this.message(t); }
  async checkName(n: string) { this.calls++; return this.base.checkName(n); }
  async writeBlog({ topic }: { topic: string }) {
    this.calls++;
    return { title: `${topic} — rehber`, summary: "Kısa özet.", body: `## Giriş\n\nBu yazı ${topic} hakkında. Ara: 0532 111 22 33\n\n- Madde bir\n- Madde iki\n\n${"Uzun paragraf. ".repeat(30)}` };
  }
}

const ai = new FakeAi();
let ctx: TestCtx;
beforeEach(async () => {
  ctx ??= await makeApp({ ai });
  await resetData(ctx.pool);
  ai.review = (i) => ({ verdict: "ok", reason: "", title: i.title, description: i.description, changes: "" });
  ai.message = () => ({ verdict: "ok", reason: "" });
  ai.images = () => ({ verdict: "ok", reason: "" });
  ai.calls = 0;
});
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });

const setting = (k: string, v: unknown) => ctx.pool.query("UPDATE settings SET value = $2 WHERE key = $1", [k, JSON.stringify(v)]);
const post = (cookie: string, payload: Record<string, unknown>) => ctx.app.inject({ method: "POST", url: "/api/requests", headers: { cookie }, payload: { ...sampleRequest, ...payload } });

describe("yapay zekâ asistanı", () => {
  it("talep metni düzeltilir, kaydedilir ve geri alınabilir; düzeltme kapalıyken metin olduğu gibi kalır", async () => {
    const buyer = await login(ctx, "05321119001");
    const admin = await login(ctx, "yonetici@almakisterim.com");
    ai.review = () => ({ verdict: "ok", reason: "", title: "2. el iPhone 13 arıyorum", description: "Temiz olsun.", changes: "Yazım hataları düzeltildi" });
    const r = await post(buyer, { title: "2.el iphone 13 arıyom", description: "temiz olsunn" });
    expect(r.json().status).toBe("active");
    const id = r.json().id;
    expect((await ctx.app.inject({ url: `/api/requests/${id}` })).json().request).toMatchObject({ title: "2. el iPhone 13 arıyorum", description: "Temiz olsun." });

    const log = (await ctx.app.inject({ url: "/api/admin/ai/actions", headers: { cookie: admin } })).json().items;
    expect(log[0]).toMatchObject({ kind: "talep_duzeltme", target_id: String(id), summary: "Yazım hataları düzeltildi", before: { title: "2.el iphone 13 arıyom" } });
    expect((await ctx.app.inject({ method: "POST", url: `/api/admin/ai/actions/${log[0].id}/undo`, headers: { cookie: admin } })).statusCode).toBe(200);
    expect((await ctx.app.inject({ url: `/api/requests/${id}` })).json().request.title).toBe("2.el iphone 13 arıyom");
    expect((await ctx.app.inject({ method: "POST", url: `/api/admin/ai/actions/${log[0].id}/undo`, headers: { cookie: admin } })).statusCode).toBe(409);

    await setting("ai_fix_text", false);
    const r2 = await post(buyer, { title: "ham başlık burada", description: "" });
    expect((await ctx.app.inject({ url: `/api/requests/${r2.json().id}` })).json().request.title).toBe("ham başlık burada");
  });

  it("karar: yasaklı talep reddedilir ve alıcıya e-posta gider; emin değilse incelemede kalır ya da ayara göre yayına girer; karar geri alınır", async () => {
    await setting("phone_required", false);
    const buyer = await login(ctx, "alici@ornek.com");
    const admin = await login(ctx, "yonetici@almakisterim.com");
    expect(ctx.outbox.sent.some((m) => m.to === "alici@ornek.com" && m.subject === "almakisterim'e hoş geldiniz")).toBe(true);

    ai.review = (i) => ({ verdict: "reject", reason: "Sahte belge talebi", title: i.title, description: i.description, changes: "" });
    const r = await post(buyer, { title: "Sahte diploma lazım" });
    expect(r.json()).toMatchObject({ status: "rejected", moderation: { reason: "Sahte belge talebi" } });
    await expect.poll(() => ctx.outbox.sent.find((m) => m.to === "alici@ornek.com" && m.subject === "Talebiniz yayınlanamadı")?.text ?? "").toContain("Sahte belge talebi");

    ai.review = (i) => ({ verdict: "review", reason: "Emin değilim", title: i.title, description: i.description, changes: "" });
    expect((await post(buyer, { title: "Şüpheli bir talep" })).json().status).toBe("pending_review");
    await setting("ai_uncertain", "publish");
    expect((await post(buyer, { title: "Şüpheli ama yayında" })).json().status).toBe("active");
    await setting("ai_auto_decide", false);
    ai.review = (i) => ({ verdict: "ok", reason: "", title: i.title, description: i.description, changes: "" });
    expect((await post(buyer, { title: "Temiz ama onay bekler" })).json().status).toBe("pending_review");

    const karar = (await ctx.app.inject({ url: "/api/admin/ai/actions?kind=talep_karar", headers: { cookie: admin } })).json().items;
    const rejected = karar.find((k: { target_id: string }) => k.target_id === String(r.json().id));
    expect(rejected.summary).toContain("Reddedildi");
    await ctx.app.inject({ method: "POST", url: `/api/admin/ai/actions/${rejected.id}/undo`, headers: { cookie: admin } });
    expect((await ctx.app.inject({ url: `/api/requests/${r.json().id}` })).json().request.status).toBe("active");
  });

  it("mesaj denetimi: küfür ve dolandırıcılık iletilmez, olağan mesaj gider; kapalıyken denetlenmez", async () => {
    const buyer = await login(ctx, "05321119002");
    const seller = await login(ctx, "05331119002");
    const id = await createRequest(ctx, buyer);
    await ctx.app.inject({ method: "POST", url: `/api/requests/${id}/unlock`, headers: { cookie: seller } });
    const send = (body: string) => ctx.app.inject({ method: "POST", url: `/api/requests/${id}/messages`, headers: { cookie: seller }, payload: { body } });
    expect((await send("Merhaba, elimde temiz bir tane var, 14.000 TL.")).statusCode).toBe(201);
    ai.message = (t) => (/kapora/i.test(t) ? { verdict: "block", reason: "Ürünü görmeden ödeme isteği" } : { verdict: "ok", reason: "" });
    const bad = await send("Önce 2000 TL kapora at IBAN'a, sonra gönderirim");
    expect(bad.statusCode).toBe(400);
    expect(bad.json()).toMatchObject({ error: "mesaj_uygunsuz" });
    expect(bad.json().message).toContain("Ürünü görmeden ödeme isteği");
    expect((await ctx.pool.query("SELECT count(*)::int AS n FROM messages")).rows[0].n).toBe(1);
    expect((await ctx.pool.query("SELECT kind FROM ai_actions")).rows.map((r) => r.kind)).toEqual(["mesaj_engel"]);
    await setting("ai_messages", false);
    expect((await send("Önce kapora at")).statusCode).toBe(201);
  });

  it("kural tabanlı yedek: küfür engellenir, kelime içindeki harfler takılmaz; başlık düzenlenir, iPhone bozulmaz", async () => {
    const h = new HeuristicAi();
    expect((await h.checkMessage("lan amk ne biçim fiyat")).verdict).toBe("block");
    expect((await h.checkMessage("Ürünü yarın götürürüm, sikke koleksiyonum da var")).verdict).toBe("ok");
    expect((await h.checkName("www.reklam.com")).verdict).toBe("block");
    expect(tidyText("ACİL SATILIK DAİRE ARIYORUM!!!", true)).toBe("Acil satılık daire arıyorum!");
    expect(tidyText("iphone 13 arıyorum")).toBe("iPhone 13 arıyorum");
    expect(tidyText("istanbul'da daire")).toBe("İstanbul'da daire");
    expect(tidyText("iPhone 13  arıyorum ,")).toBe("iPhone 13 arıyorum,");
  });

  it("üye adı denetimi: kayıtta ve ad değiştirmede uygunsuz ad kullanılamaz", async () => {
    const bad = await ctx.app.inject({ method: "POST", url: "/api/auth/code", payload: { channel: "sms", target: "05321119003" } });
    expect(bad.statusCode).toBe(200);
    const code = ctx.outbox.last("905321119003")!.text.match(/\d{6}/)![0];
    const v = await ctx.app.inject({ method: "POST", url: "/api/auth/verify", payload: { channel: "sms", target: "05321119003", code, name: "Şerefsiz Adam" } });
    expect(v.statusCode).toBe(400);
    expect(v.json().error).toBe("ad_uygunsuz");
    const user = await login(ctx, "05321119004");
    expect((await ctx.app.inject({ method: "PATCH", url: "/api/me", headers: { cookie: user }, payload: { name: "Pezevenk Ali" } })).statusCode).toBe(400);
    expect((await ctx.app.inject({ method: "PATCH", url: "/api/me", headers: { cookie: user }, payload: { name: "Ali Yılmaz" } })).statusCode).toBe(200);
  });

  it("blog: yapay zekâ yazar (taslak), iletişim bilgisi silinir, yönetici yayınlar; herkese açık sayfada görünür", async () => {
    const admin = await login(ctx, "yonetici@almakisterim.com");
    const g = await ctx.app.inject({ method: "POST", url: "/api/admin/blog/generate", headers: { cookie: admin }, payload: { topic: "Arsa alırken imar durumu" } });
    expect(g.statusCode, g.body).toBe(201);
    expect(g.json()).toMatchObject({ status: "draft", slug: "arsa-alirken-imar-durumu-rehber", source: "ai" });
    expect(g.json().body).not.toContain("111 22 33");
    expect((await ctx.app.inject({ url: "/api/blog" })).json().items).toEqual([]);
    expect((await ctx.app.inject({ url: `/api/blog/${g.json().slug}` })).statusCode).toBe(404);
    await ctx.app.inject({ method: "PATCH", url: `/api/admin/blog/${g.json().id}`, headers: { cookie: admin }, payload: { status: "published", title: "Arsa alırken imar durumu nasıl kontrol edilir?" } });
    expect((await ctx.app.inject({ url: "/api/blog" })).json().items[0]).toMatchObject({ slug: g.json().slug, title: "Arsa alırken imar durumu nasıl kontrol edilir?" });
    expect((await ctx.app.inject({ url: `/api/blog/${g.json().slug}` })).json().body).toContain("## Giriş");
    // Aynı başlıktan ikinci yazı farklı adres alır.
    const g2 = await ctx.app.inject({ method: "POST", url: "/api/admin/blog/generate", headers: { cookie: admin }, payload: { topic: "Arsa alırken imar durumu", publish: true } });
    expect(g2.json()).toMatchObject({ slug: "arsa-alirken-imar-durumu-rehber-2", status: "published" });
    // Hazır konudan yazılan yazı kendi kategorisine bağlanır (altında o kategorinin talepleri çıkar); serbest konu bağlanmaz.
    expect((await ctx.app.inject({ url: `/api/blog/${g2.json().slug}` })).json()).toMatchObject({ top: null });
    expect((await ctx.app.inject({ url: `/api/blog/${g2.json().slug}` })).json().topic).toBeUndefined();
    const g3 = await ctx.app.inject({ method: "POST", url: "/api/admin/blog/generate", headers: { cookie: admin }, payload: { topic: "İkinci el araba alırken nelere dikkat edilmeli?", publish: true } });
    expect((await ctx.app.inject({ url: `/api/blog/${g3.json().slug}` })).json()).toMatchObject({ top: "vasita" });
    expect((await ctx.app.inject({ url: "/api/admin/blog/generate", method: "POST", headers: { cookie: await login(ctx, "05321119005") }, payload: { topic: "Deneme konusu" } })).statusCode).toBe(403);
    // Elle yazı: yapay zekâ olmadan da eklenir; iletişim bilgisi yine silinir, kısa yazı reddedilir.
    const m = await ctx.app.inject({ method: "POST", url: "/api/admin/blog", headers: { cookie: admin },
      payload: { title: "Güvenli alışveriş için beş öneri", summary: "Kısa rehber", body: "## Kapora vermeyin\nÜrünü görmeden para göndermeyin. Bilgi için 0532 111 22 33 arayın.", publish: true } });
    expect(m.statusCode, m.body).toBe(201);
    expect(m.json()).toMatchObject({ slug: "guvenli-alisveris-icin-bes-oneri", source: "manual", status: "published" });
    expect(m.json().body).not.toContain("111 22 33");
    expect((await ctx.app.inject({ method: "POST", url: "/api/admin/blog", headers: { cookie: admin }, payload: { title: "Kısa yazı", body: "çok kısa" } })).statusCode).toBe(400);
  });

  it("otomatik blog ve hatırlatma saatlik işte çalışır; yapay zekâ yoksa blog yazılamaz diye açık bir hata döner", async () => {
    await setting("ai_blog_every_days", 7);
    await setting("ai_blog_autopublish", true);
    await setting("phone_required", false);
    const buyer = await login(ctx, "hatirlat@ornek.com");
    const id = await createRequest(ctx, buyer);
    await ctx.pool.query("UPDATE requests SET expires_at = now() + interval '1 day' WHERE id = $1", [id]);
    const job = () => ctx.app.inject({ method: "POST", url: "/api/jobs/expire", headers: { "x-job-token": "test-job-token-123" } });
    const r = (await job()).json();
    expect(r.reminded).toBe(1);
    expect(r.blog).toMatch(/^ikinci-el-araba/);
    expect(ctx.outbox.sent.some((m) => m.to === "hatirlat@ornek.com" && m.subject === "Talebinizin süresi dolmak üzere")).toBe(true);
    // Aynı gün tekrar çalışınca yeni yazı ve tekrar hatırlatma yok.
    expect((await job()).json()).toMatchObject({ reminded: 0, blog: null });

    const plain = await makeApp();
    try {
      const admin = await login(plain, "yonetici@almakisterim.com");
      const g = await plain.app.inject({ method: "POST", url: "/api/admin/blog/generate", headers: { cookie: admin }, payload: { topic: "Deneme konusu" } });
      expect(g.statusCode).toBe(503);
      expect(g.json().message).toContain("yapay zekâ bağlı olmalı");
    } finally { await plain.app.close(); await plain.pool.end(); }
  });

  it("günlük sınır dolunca yapay zekâ yerine kural tabanlı yedek çalışır; panel ayarları ve sayaç görünür; mevcut talepler taranır", async () => {
    const admin = await login(ctx, "yonetici@almakisterim.com");
    const buyer = await login(ctx, "05321119006");
    // Girişteki ad denetimi de sayılır; sayaç sıfırdan başlasın.
    await ctx.pool.query("DELETE FROM ai_usage");
    ai.calls = 0;
    const put = await ctx.app.inject({ method: "PUT", url: "/api/admin/ai/settings", headers: { cookie: admin }, payload: { ai_daily_limit: 2, ai_uncertain: "publish" } });
    expect(put.statusCode).toBe(200);
    ai.review = (i) => ({ verdict: "ok", reason: "", title: `${i.title} (yz)`, description: i.description, changes: "x" });
    await post(buyer, { title: "Birinci talep" });
    await post(buyer, { title: "İkinci talep" });
    const third = await post(buyer, { title: "Üçüncü talep" });
    expect(ai.calls).toBe(2);
    expect((await ctx.app.inject({ url: `/api/requests/${third.json().id}` })).json().request.title).toBe("Üçüncü talep");
    const panel = (await ctx.app.inject({ url: "/api/admin/ai", headers: { cookie: admin } })).json();
    expect(panel).toMatchObject({ usage: { today: 2, limit: 2 }, settings: { ai_daily_limit: 2, ai_uncertain: "publish", ai_fix_text: true }, counts: { talep_duzeltme: 2 } });
    expect(panel.topics.length).toBeGreaterThan(5);

    await ctx.app.inject({ method: "PUT", url: "/api/admin/ai/settings", headers: { cookie: admin }, payload: { ai_daily_limit: 100 } });
    await ctx.pool.query("UPDATE requests SET ai_checked_at = NULL, title = 'eski talep başlığı' WHERE id = $1", [third.json().id]);
    const scan = (await ctx.app.inject({ method: "POST", url: "/api/admin/ai/scan", headers: { cookie: admin } })).json();
    expect(scan).toMatchObject({ checked: 1, fixed: 1 });
    expect((await ctx.app.inject({ url: `/api/requests/${third.json().id}` })).json().request.title).toBe("eski talep başlığı (yz)");
    expect((await ctx.app.inject({ url: "/api/admin/ai", headers: { cookie: buyer } })).statusCode).toBe(403);
  });

  it("yapay zekâ çalışmadığı için bekletilen talep saatlik işte yeniden denetlenir; uygunsa yayına çıkar ve sahibine haber gider", async () => {
    await setting("phone_required", false);
    const buyer = await login(ctx, "05321119050");
    const job = () => ctx.app.inject({ method: "POST", url: "/api/jobs/expire", headers: { "x-job-token": "test-job-token-123" } });
    const held = async (title: string) => {
      const id = (await post(buyer, { title })).json().id as number;
      const owner = (await ctx.pool.query("SELECT buyer_id FROM requests WHERE id = $1", [id])).rows[0].buyer_id;
      await ctx.pool.query("INSERT INTO media (owner_id, kind, storage_key, content_type, size_bytes, status, request_id) VALUES ($1, 'image', $2, 'image/png', 10, 'ready', $3)", [owner, `t/${id}.png`, id]);
      await ctx.pool.query("UPDATE requests SET status = 'pending_review', moderation_note = 'Görseller otomatik denetlenemedi.' WHERE id = $1", [id]);
      return id;
    };
    const status = async (id: number) => (await ctx.pool.query("SELECT status, moderation_note FROM requests WHERE id = $1", [id])).rows[0];
    const bells = async () => (await ctx.pool.query("SELECT text FROM notifications n JOIN users u ON u.id = n.user_id WHERE u.phone LIKE '%5321119050' ORDER BY n.id")).rows.map((r) => r.text);
    const a = await held("Uygun talep bir"), b = await held("Uygunsuz talep iki");

    // Yapay zekâ hâlâ çalışmıyorsa dokunulmaz.
    ai.images = () => ({ verdict: "review", reason: "Görseller otomatik denetlenemedi." });
    expect((await job()).json().rechecked).toEqual({ checked: 0, published: 0 });
    expect((await status(a)).status).toBe("pending_review");

    // Çalışınca: uygun olan yayına çıkar, yasaklı görsel reddedilir; ikisine de bildirim gider.
    ai.images = (urls) => (urls[0]!.includes(`${b}.png`) ? { verdict: "reject", reason: "Uygunsuz görsel" } : { verdict: "ok", reason: "" });
    expect((await job()).json().rechecked).toEqual({ checked: 2, published: 1 });
    expect(await status(a)).toEqual({ status: "active", moderation_note: null });
    expect(await status(b)).toEqual({ status: "rejected", moderation_note: "Uygunsuz görsel" });
    await expect.poll(bells).toEqual(expect.arrayContaining(['"Uygun talep bir" talebiniz onaylandı ve yayına çıktı.', '"Uygunsuz talep iki" talebiniz kurallara uymadığı için yayınlanmadı. Neden: Uygunsuz görsel']));
    // Günlük sınır dolduysa fotoğraf denetimsiz yayına girmez, bekletilir.
    await setting("ai_daily_limit", 0);
    const c = (await post(buyer, { title: "Sınır dolu talep", media_ids: [] })).json();
    expect(c.status).toBe("active"); // fotoğrafsız talepte görsel denetimi gerekmez
  });
});
