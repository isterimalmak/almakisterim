import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { mailTick, quietShift } from "../src/modules/mailstudio.js";
import { createRequest, login, makeApp, resetData, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
beforeEach(async () => {
  ctx ??= await makeApp();
  await resetData(ctx.pool);
});
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });

const ADMIN = "yonetici@almakisterim.com";
const tick = () => mailTick({ pool: ctx.pool, config: ctx.config, mailer: ctx.outbox, storage: ctx.storage });
type Tpl = { id: number; name: string; subject: string; preheader: string; kind: "info" | "marketing"; blocks: Record<string, unknown>[]; theme: Record<string, unknown> };
const draft = (t: Tpl) => ({ name: t.name, subject: t.subject, preheader: t.preheader, kind: t.kind, blocks: t.blocks, theme: t.theme });

async function fromStarter(admin: string, starter: string): Promise<Tpl> {
  const r = await ctx.app.inject({ method: "POST", url: "/api/admin/mail/templates", headers: { cookie: admin }, payload: { starter } });
  expect(r.statusCode).toBe(201);
  return (await ctx.app.inject({ url: `/api/admin/mail/templates/${r.json().id}`, headers: { cookie: admin } })).json().template;
}
async function rule(admin: string, body: Record<string, unknown>) {
  return ctx.app.inject({ method: "POST", url: "/api/admin/mail/rules", headers: { cookie: admin }, payload: { name: "Görev", quietHours: false, active: true, ...body } });
}

describe("E-posta Stüdyosu", () => {
  it("yalnızca yönetici kullanabilir", async () => {
    expect((await ctx.app.inject({ url: "/api/admin/mail" })).statusCode).toBe(401);
    const user = await login(ctx, "05321112233", "Ali Veli");
    expect((await ctx.app.inject({ url: "/api/admin/mail", headers: { cookie: user } })).statusCode).toBe(403);
    expect((await ctx.app.inject({ method: "POST", url: "/api/admin/mail/templates", headers: { cookie: user }, payload: { starter: "welcome" } })).statusCode).toBe(403);
    const admin = await login(ctx, ADMIN, "Yönetici Bey");
    const home = (await ctx.app.inject({ url: "/api/admin/mail", headers: { cookie: admin } })).json();
    expect(home.starters.map((s: { key: string }) => s.key)).toContain("welcome");
    expect(home.ready).toBe(false);
  });

  it("hazır şablondan şablon açılır, kaydedilir; önizlemede bloklar ve {ad} dolu, talepler bloğu talebi gösterir", async () => {
    const admin = await login(ctx, ADMIN, "Ayşe Yılmaz");
    const buyer = await login(ctx, "05321112233", "Alıcı Kişi");
    const reqId = await createRequest(ctx, buyer, { title: "Satılık 2. el bisiklet arıyorum" });
    const t = await fromStarter(admin, "welcome");
    expect(t.name).toBe("Hoş geldiniz");
    expect(t.theme.accent).toBe("#F26B1D");
    const blocks = [...t.blocks, { id: "talep1", type: "requests", title: "Öne çıkanlar", ids: [reqId] }, { id: "baslik1", type: "heading", text: "Merhaba {ad}, yeni başlık" }];
    const save = await ctx.app.inject({ method: "PUT", url: `/api/admin/mail/templates/${t.id}`, headers: { cookie: admin }, payload: { ...draft(t), blocks } });
    expect(save.statusCode).toBe(200);
    expect(save.json().template.blocks).toHaveLength(blocks.length);
    const r = await ctx.app.inject({ method: "POST", url: "/api/admin/mail/render", headers: { cookie: admin }, payload: save.json().template });
    expect(r.statusCode).toBe(200);
    const html: string = r.json().html;
    expect(html).toContain("Merhaba Ayşe, yeni başlık");
    expect(html).toContain("Aramıza hoş geldiniz, Ayşe!");
    expect(html).toContain("Satılık 2. el bisiklet arıyorum");
    expect(html).toContain(`/talep/${reqId}`);
    expect(html).toContain("almakisterim<span");
    expect(html).toContain('data-b="talep1"');
    // geçersiz blok reddedilir
    const bad = await ctx.app.inject({ method: "PUT", url: `/api/admin/mail/templates/${t.id}`, headers: { cookie: admin }, payload: { ...draft(t), blocks: [{ id: "x", type: "products", ids: [] }] } });
    expect(bad.statusCode).toBe(400);
  });

  it("görev: tek seferlik gönderim tarih ister", async () => {
    const admin = await login(ctx, ADMIN);
    const t = await fromStarter(admin, "campaign");
    const r = await rule(admin, { templateId: t.id, trigger: "once", audience: "all" });
    expect(r.statusCode).toBe(400);
    expect(r.json().message).toContain("tarih");
    const ok = await rule(admin, { templateId: t.id, trigger: "once", audience: "buyers", sendAt: new Date(Date.now() + 3600e3).toISOString() });
    expect(ok.statusCode).toBe(201);
    const aud = await ctx.app.inject({ url: "/api/admin/mail/audience?audience=all&kind=marketing", headers: { cookie: admin } });
    expect(aud.json()).toEqual({ count: 0, total: 1 });
  });

  it("yeni üye olunca görev sıraya girer, iş html e-postayı gönderir; açılma ve tıklama izlenir", async () => {
    const admin = await login(ctx, ADMIN);
    const t = await fromStarter(admin, "welcome");
    expect((await rule(admin, { templateId: t.id, trigger: "signup" })).statusCode).toBe(201);
    await login(ctx, "yeni.uye@example.com", "Zeynep Kaya");
    const q = (await ctx.pool.query("SELECT status, email FROM mail_sends WHERE rule_id IS NOT NULL")).rows;
    expect(q).toEqual([{ status: "queued", email: "yeni.uye@example.com" }]);
    // telefonla üye olana e-posta gitmez
    await login(ctx, "05329998877", "Telefonlu Üye");
    expect((await ctx.pool.query("SELECT count(*)::int AS n FROM mail_sends")).rows[0].n).toBe(1);

    ctx.outbox.sent = [];
    const res = await tick();
    expect(res.sent).toBe(1);
    const m = ctx.outbox.sent.find((x) => x.to === "yeni.uye@example.com")!;
    expect(m.subject).toBe("almakisterim'e hoş geldiniz Zeynep");
    expect(m.html).toContain("Aramıza hoş geldiniz, Zeynep!");
    expect(m.text).toContain("Ücretsiz talep ver: http://localhost:3000/talep-ver");
    const s = (await ctx.pool.query("SELECT status, token FROM mail_sends")).rows[0];
    expect(s.status).toBe("sent");

    // açılma pikseli
    const px = await ctx.app.inject({ url: `/api/m/o/${s.token}` });
    expect(px.headers["content-type"]).toBe("image/gif");
    expect((await ctx.pool.query("SELECT opened_at FROM mail_sends")).rows[0].opened_at).not.toBeNull();

    // tıklama: imzalı bağlantı yönlendirir, imzası bozuk olan ana sayfaya döner
    const link = m.html!.match(/href="(http:\/\/localhost:3000\/api\/m\/c\/[^"]+talep-ver[^"]+)"/)![1]!.replace(/&amp;/g, "&");
    const path = link.replace("http://localhost:3000", "");
    const good = await ctx.app.inject({ url: path });
    expect(good.statusCode).toBe(302);
    expect(good.headers.location).toBe("http://localhost:3000/talep-ver");
    const bad = await ctx.app.inject({ url: path.replace(/&s=[^&]+/, "&s=AAAAAAAAAAAAAAAAAAAAAA") });
    expect(bad.headers.location).toBe("http://localhost:3000/");
    const evil = await ctx.app.inject({ url: `/api/m/c/${s.token}?u=${encodeURIComponent("https://kotu.example.com")}&s=x` });
    expect(evil.headers.location).toBe("http://localhost:3000/");
    expect((await ctx.pool.query("SELECT clicked_at FROM mail_sends")).rows[0].clicked_at).not.toBeNull();
  });

  it("kampanya şablonu izin vermeyene gitmez; izin veren abonelikten çıkınca izin kalkar", async () => {
    const admin = await login(ctx, ADMIN);
    const t = await fromStarter(admin, "norequest");
    expect(t.kind).toBe("marketing");
    await ctx.app.inject({ method: "PUT", url: `/api/admin/mail/templates/${t.id}`, headers: { cookie: admin }, payload: draft(t) });
    expect((await rule(admin, { templateId: t.id, trigger: "signup" })).statusCode).toBe(201);
    await login(ctx, "izinsiz@example.com", "İzinsiz Üye");
    const izinli = await login(ctx, "izinli@example.com", "İzinli Üye");
    expect((await ctx.app.inject({ method: "PATCH", url: "/api/me", headers: { cookie: izinli }, payload: { marketing: true } })).statusCode).toBe(200);
    expect((await ctx.app.inject({ url: "/api/me", headers: { cookie: izinli } })).json().user.marketing).toBe(true);

    ctx.outbox.sent = [];
    const r = await tick();
    expect(r).toMatchObject({ sent: 1, skipped: 1 });
    expect((await ctx.pool.query("SELECT note FROM mail_sends WHERE email = 'izinsiz@example.com'")).rows[0].note).toBe("Kampanya izni yok");
    const m = ctx.outbox.sent.find((x) => x.to === "izinli@example.com")!;
    expect(m.headers?.["List-Unsubscribe"]).toMatch(/\/api\/m\/u\//);
    expect(m.html).toContain("Abonelikten çık");

    const tok = (await ctx.pool.query("SELECT token FROM mail_sends WHERE email = 'izinli@example.com'")).rows[0].token;
    const page = await ctx.app.inject({ url: `/api/m/u/${tok}` });
    expect(page.body).toContain("izinli@example.com adresine kampanya e-postası gönderilmesin mi?");
    const post = await ctx.app.inject({ method: "POST", url: `/api/m/u/${tok}`, headers: { "content-type": "application/x-www-form-urlencoded" }, payload: "" });
    expect(post.statusCode).toBe(200);
    expect(post.body).toContain("Abonelikten çıktınız");
    expect((await ctx.app.inject({ url: "/api/me", headers: { cookie: izinli } })).json().user.marketing).toBe(false);
  });

  it("deneme gönderimi yöneticinin adresine gider", async () => {
    const admin = await login(ctx, ADMIN, "Yönetici");
    const t = await fromStarter(admin, "published");
    ctx.outbox.sent = [];
    const r = await ctx.app.inject({ method: "POST", url: `/api/admin/mail/templates/${t.id}/test`, headers: { cookie: admin }, payload: {} });
    expect(r.statusCode).toBe(200);
    expect(ctx.outbox.sent[0]!.subject).toMatch(/^\[Deneme\] /);
    expect(ctx.outbox.sent[0]!.html).toContain("Örnek talep: 2. el iPhone 13");
  });

  it("talep yayına girince ve süresi dolunca görevler sıraya girer; saatlik iş e-postaları da gönderir", async () => {
    const admin = await login(ctx, ADMIN);
    const pub = await fromStarter(admin, "published");
    const exp = await fromStarter(admin, "expired");
    await rule(admin, { templateId: pub.id, trigger: "request_published" });
    await rule(admin, { templateId: exp.id, trigger: "request_expired" });
    const buyer = await login(ctx, "alici.mail@example.com", "Mehmet Alıcı");
    await ctx.pool.query("UPDATE users SET phone = '905321234567' WHERE email = 'alici.mail@example.com'");
    const id = await createRequest(ctx, buyer, { title: "Kiralık 3+1 daire arıyorum" });
    await expect.poll(async () => (await ctx.pool.query("SELECT count(*)::int AS n FROM mail_sends WHERE request_id = $1", [id])).rows[0].n).toBe(1);
    await ctx.pool.query("UPDATE requests SET expires_at = now() - interval '1 minute' WHERE id = $1", [id]);
    ctx.outbox.sent = [];
    const job = await ctx.app.inject({ method: "POST", url: "/api/jobs/expire", headers: { "x-job-token": "test-job-token-123" } });
    expect(job.json().mail.sent).toBe(2);
    const subjects = ctx.outbox.sent.filter((x) => x.to === "alici.mail@example.com").map((x) => x.subject);
    expect(subjects).toEqual(expect.arrayContaining(["Mehmet, talebiniz yayında", "Mehmet, talebinizin süresi doldu"]));
    expect(ctx.outbox.sent.find((x) => x.subject === "Mehmet, talebiniz yayında")!.html).toContain("Kiralık 3+1 daire arıyorum");
    expect((await ctx.app.inject({ method: "POST", url: "/api/jobs/mail", headers: { "x-job-token": "yanlis" } })).statusCode).toBe(404);
  });

  it("sessiz saatler: İstanbul 21:00–09:00 arası sabah 09:00'a kayar", () => {
    // 12:00 İstanbul (09:00 UTC) aynen kalır
    expect(quietShift(new Date("2026-10-20T09:00:00Z")).toISOString()).toBe("2026-10-20T09:00:00.000Z");
    // 22:30 İstanbul → ertesi gün 09:00 İstanbul (06:00 UTC)
    expect(quietShift(new Date("2026-10-20T19:30:00Z")).toISOString()).toBe("2026-10-21T06:00:00.000Z");
    // 03:00 İstanbul → aynı gün 09:00
    expect(quietShift(new Date("2026-10-20T00:00:00Z")).toISOString()).toBe("2026-10-20T06:00:00.000Z");
    // 20:59 İstanbul kalır
    expect(quietShift(new Date("2026-10-20T17:59:00Z")).toISOString()).toBe("2026-10-20T17:59:00.000Z");
  });
});
