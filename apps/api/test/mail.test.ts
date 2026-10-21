import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequest, login, makeApp, postOffer, resetData, type TestCtx } from "./helpers.js";
import { MAIL_LIMITS, mailUsage, metered } from "../src/services/mail-usage.js";
import { branded, MemoryOutbox, ResendMailer } from "../src/services/notify.js";

let ctx: TestCtx;
beforeEach(async () => {
  ctx ??= await makeApp();
  await resetData(ctx.pool);
  ctx.outbox.sent.length = 0;
});
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });

const offer = { price: 18500, condition: "İkinci el, çok iyi", delivery: "Ertesi gün kargo", warranty: true, note: "Kutulu ve faturalı" };
const mails = (to: string) => ctx.outbox.sent.filter((m) => m.to === to && m.subject);

describe("e-posta", () => {
  it("anahtar yokken e-posta gönderilmez, bellekteki kutuya düşer; kutu en fazla 50 kayıt tutar", async () => {
    const box = new MemoryOutbox();
    for (let i = 0; i < 60; i++) await box.send(`u${i}@ornek.com`, "Konu", `metin ${i}`);
    expect(box.sent).toHaveLength(50);
    expect(box.sent[0]!.to).toBe("u10@ornek.com");
    expect(box.last("u59@ornek.com")?.text).toBe("metin 59");
  });

  it("giriş kodu doğru alıcıya marka şablonuyla gider; Resend hatasında anahtar ve içerik hata metnine sızmaz", async () => {
    await ctx.app.inject({ method: "POST", url: "/api/auth/code", payload: { channel: "email", target: "Ayse@Ornek.com" } });
    const m = ctx.outbox.last("ayse@ornek.com")!;
    expect(m.subject).toBe("almakisterim giriş kodunuz");
    expect(m.text).toMatch(/\d{6}/);

    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response("{}", { status: 401 }); });
    const key = "re_gizli_deneme_anahtari";
    const mailer = branded(new ResendMailer(key, "almakisterim <bildirim@almakisterim.com>"), "https://almakisterim.com");
    const err = await mailer.send("ayse@ornek.com", "Şifre", "Bağlantınız:\nhttps://almakisterim.com/gizli-baglanti").catch((e: Error) => e);
    expect((err as Error).message).toBe("Resend hata kodu 401");
    expect((err as Error).message).not.toContain(key);
    // Anahtar yalnızca sunucudan Resend'e giden istekte, başlıkta durur.
    expect(calls[0]!.url).toBe("https://api.resend.com/emails");
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe(`Bearer ${key}`);
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body).toMatchObject({ from: "almakisterim <bildirim@almakisterim.com>", to: ["ayse@ornek.com"], subject: "Şifre" });
    expect(body.html).toContain("Düğme çalışmazsa bu adresi tarayıcınıza yapıştırın: https://almakisterim.com/gizli-baglanti");
    expect(body.html).toContain("https://almakisterim.com/logo.png");
  });

  it("gönderim sayılır; sınıra yaklaşınca yönetici uyarılır, günlük sınırın sonunda yalnız giriş kodları gider; uyarıda adres ve içerik loglanmaz", async () => {
    await login(ctx, "yonetici@almakisterim.com");
    const warns: unknown[] = [];
    const log = { warn: (o: unknown) => warns.push(o) } as never;
    const inner = new MemoryOutbox();
    const m = metered(inner, ctx.pool, () => true, log);

    await ctx.pool.query("INSERT INTO mail_usage (day, n) VALUES (current_date, $1) ON CONFLICT (day) DO UPDATE SET n = $1", [MAIL_LIMITS.day * 0.8 - 1]);
    await m.send("a@ornek.com", "Bilgi", "metin");
    const note = (await ctx.pool.query("SELECT text FROM notifications n JOIN users u ON u.id = n.user_id WHERE u.role = 'admin'")).rows;
    expect(note).toHaveLength(1);
    expect(note[0].text).toContain("E-posta sınırına yaklaşıldı");
    expect((await mailUsage(ctx.pool))).toMatchObject({ day: 80, warn: true });

    await ctx.pool.query("UPDATE mail_usage SET n = $1", [MAIL_LIMITS.day - 10]);
    await expect(m.send("a@ornek.com", "Kampanya", "metin")).rejects.toThrow("sınır");
    await m.send("a@ornek.com", "almakisterim giriş kodunuz", "kod", { critical: true });
    expect(inner.sent.map((x) => x.subject)).toEqual(["Bilgi", "almakisterim giriş kodunuz"]);
    expect(JSON.stringify(warns)).not.toContain("a@ornek.com");
    expect(JSON.stringify(warns)).not.toContain("Kampanya");

    // Resend dışında (SMTP / anahtarsız) sayaç işler ama sınır uygulanmaz.
    await metered(inner, ctx.pool, () => false).send("b@ornek.com", "Bilgi", "metin");
    expect(inner.last("b@ornek.com")).toBeTruthy();
  });

  it("e-posta bildirimleri: yeni teklif, teklif kabul ve yeni mesaj Bana Özel'den kapatılır; mesaj e-postası saatte bir", async () => {
    await ctx.pool.query("UPDATE settings SET value = 'false' WHERE key = 'phone_required'");
    const buyer = await login(ctx, "alici@ornek.com", "Elif Sönmez");
    const seller = await login(ctx, "satici@ornek.com", "Ahmet Kaya");
    const me = async (c: string) => (await ctx.app.inject({ url: "/api/me", headers: { cookie: c } })).json().user;
    expect((await me(buyer)).mail_prefs).toEqual({ offer: true, accepted: true, message: true });

    const id = await createRequest(ctx, buyer);
    expect((await postOffer(ctx, seller, id, offer)).statusCode).toBe(201);
    await vi.waitFor(() => expect(mails("alici@ornek.com").map((m) => m.subject)).toContain("Talebinize yeni teklif geldi"));

    // Mesaj: ilk mesajda e-posta gider, bir saat içindeki ikincisinde gitmez.
    await ctx.app.inject({ method: "POST", url: `/api/requests/${id}/unlock`, headers: { cookie: seller } });
    const msg = (body: string) => ctx.app.inject({ method: "POST", url: `/api/requests/${id}/messages`, headers: { cookie: seller }, payload: { body } });
    expect((await msg("Merhaba, ürün elimde.")).statusCode).toBe(201);
    expect((await msg("Fotoğraf da atabilirim.")).statusCode).toBe(201);
    await vi.waitFor(() => expect(mails("alici@ornek.com").filter((m) => m.subject === "Yeni mesajınız var")).toHaveLength(1));
    expect(mails("alici@ornek.com").find((m) => m.subject === "Yeni mesajınız var")!.text).toContain(`/talep/${id}#mesajlar`);

    // Kapatınca gitmez; yalnız bilinen ayarlar kabul edilir.
    expect((await ctx.app.inject({ method: "PATCH", url: "/api/me", headers: { cookie: buyer }, payload: { mail_prefs: { offer: false, message: false } } })).statusCode).toBe(200);
    expect((await ctx.app.inject({ method: "PATCH", url: "/api/me", headers: { cookie: buyer }, payload: { mail_prefs: { uydurma: true } } })).statusCode).toBe(400);
    expect((await me(buyer)).mail_prefs).toEqual({ offer: false, accepted: true, message: false });
    await ctx.pool.query("UPDATE notifications SET created_at = now() - interval '2 hours'");
    ctx.outbox.sent.length = 0;
    const other = await login(ctx, "satici2@ornek.com", "Can Yıldız");
    expect((await postOffer(ctx, other, id, offer)).statusCode).toBe(201);
    expect((await msg("Hâlâ ilgileniyor musunuz?")).statusCode).toBe(201);
    await new Promise((r) => setTimeout(r, 100));
    expect(mails("alici@ornek.com")).toHaveLength(0);

    // Teklif kabul e-postası satıcıya gider (satıcı kapatmadıysa).
    const offers = (await ctx.app.inject({ url: `/api/requests/${id}`, headers: { cookie: buyer } })).json().offers as { id: number; seller_name: string }[];
    const first = offers.find((o) => o.seller_name === "Ahmet K.")!;
    expect((await ctx.app.inject({ method: "POST", url: `/api/offers/${first.id}/accept`, headers: { cookie: buyer } })).statusCode).toBe(200);
    await vi.waitFor(() => expect(mails("satici@ornek.com").map((m) => m.subject)).toContain("Teklifiniz kabul edildi"));
  });
});
