import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decrypt, encrypt, Integrations, live } from "../src/services/integrations.js";
import { login, makeApp, resetData, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
let admin: string;
// Yönetici e-postasına dakikada bir kod gider; dosyada bir kez giriş yapılır.
beforeAll(async () => { ctx = await makeApp(); await resetData(ctx.pool); admin = await login(ctx, "yonetici@almakisterim.com"); });
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });

describe("yönetim → entegrasyonlar", () => {
  it("anahtar panelden girilir: şifreli saklanır, hiçbir yanıtta dönmez, yapılandırmaya hemen uygulanır, silinince sunucu ayarına döner", async () => {
    const buyer = await login(ctx, "05321118801");
    const put = (key: string, value: string, cookie = admin) => ctx.app.inject({ method: "PUT", url: `/api/admin/integrations/${key}`, headers: { cookie }, payload: { value } });
    const get = async () => (await ctx.app.inject({ url: "/api/admin/integrations", headers: { cookie: admin } }));
    const field = async (key: string) => (await get()).json().groups.flatMap((g: { fields: unknown[] }) => g.fields).find((f: { key: string }) => f.key === key);

    expect((await put("ANTHROPIC_API_KEY", "sk-ant-deneme", buyer)).statusCode).toBe(403);
    expect((await put("DATABASE_URL", "postgres://kotu")).statusCode).toBe(404);
    expect((await put("ANTHROPIC_API_KEY", "   ")).statusCode).toBe(400);

    // Kopyalarken gelen boşluk ve satır sonu temizlenir.
    expect((await put("ANTHROPIC_API_KEY", "  sk-ant-gizli-123\n")).statusCode).toBe(200);
    expect(ctx.config.ANTHROPIC_API_KEY).toBe("sk-ant-gizli-123");
    const all = (await get()).body;
    expect(all).not.toContain("sk-ant-gizli-123");
    expect(await field("ANTHROPIC_API_KEY")).toMatchObject({ set: true, source: "panel", secret: true });
    expect((await field("ANTHROPIC_API_KEY")).value).toBeUndefined();
    const row = (await ctx.pool.query("SELECT value_enc FROM integration_settings WHERE name = 'ANTHROPIC_API_KEY'")).rows[0].value_enc as string;
    expect(row).not.toContain("sk-ant");
    expect(decrypt(ctx.config.CODE_PEPPER, row)).toBe("sk-ant-gizli-123");
    expect(decrypt("baska-bir-pepper-degeri-1234", row)).toBeNull();

    // Gizli olmayan alan geri gösterilir.
    await put("MAIL_FROM", "almakisterim <info@almakisterim.com>");
    expect(await field("MAIL_FROM")).toMatchObject({ value: "almakisterim <info@almakisterim.com>", source: "panel" });

    // Silince sunucu ayarına (burada boş) döner.
    expect((await ctx.app.inject({ method: "DELETE", url: "/api/admin/integrations/ANTHROPIC_API_KEY", headers: { cookie: admin } })).statusCode).toBe(200);
    expect(ctx.config.ANTHROPIC_API_KEY).toBe("");
    expect(await field("ANTHROPIC_API_KEY")).toMatchObject({ set: false, source: "yok" });
  });

  it("test düğmeleri: anahtar yoksa ne eksik olduğunu söyler; e-posta denemesi yöneticiye gider", async () => {
    const test = async (g: string) => (await ctx.app.inject({ method: "POST", url: `/api/admin/integrations/${g}/test`, headers: { cookie: admin } })).json();
    expect(await test("ai")).toMatchObject({ ok: false, message: expect.stringContaining("girilmemiş") });
    expect(await test("sms")).toMatchObject({ ok: false, message: expect.stringContaining("üçü de") });
    expect(await test("google")).toMatchObject({ ok: false, message: expect.stringContaining("girilmeli") });
    expect(await test("mail")).toMatchObject({ ok: false, message: "API anahtarı girilmemiş." });
    await ctx.app.inject({ method: "PUT", url: "/api/admin/integrations/RESEND_API_KEY", headers: { cookie: admin }, payload: { value: "re_deneme" } });
    const before = ctx.outbox.sent.length;
    expect(await test("mail")).toMatchObject({ ok: true });
    expect(ctx.outbox.sent.slice(before).map((m) => m.to)).toEqual(["yonetici@almakisterim.com"]);
    expect(await test("storage")).toMatchObject({ ok: true, message: expect.stringContaining("silindi") });
    expect((await ctx.app.inject({ method: "POST", url: "/api/admin/integrations/yok/test", headers: { cookie: admin } })).statusCode).toBe(400);
  });

  it("değişiklik hizmetleri yeniden kurar; başka sunucu da dakikalık kontrolde görür; canlı nesne güncel hizmete yönlenir", async () => {
    let built = 0;
    const cfg = { ...ctx.config };
    const other = new Integrations(ctx.pool, cfg, () => { built++; });
    expect(await other.refresh(true)).toBe(true);
    expect(await other.refresh()).toBe(false);
    await ctx.pool.query("INSERT INTO integration_settings (name, value_enc) VALUES ('PIXABAY_API_KEY', $1) ON CONFLICT (name) DO UPDATE SET value_enc = EXCLUDED.value_enc, updated_at = now()",
      [encrypt(cfg.CODE_PEPPER, "pixabay-anahtari")]);
    expect(await other.refresh()).toBe(true);
    expect(cfg.PIXABAY_API_KEY).toBe("pixabay-anahtari");
    expect(built).toBe(2);
    let cur = { hi: () => "eski" };
    const p = live(() => cur);
    expect(p.hi()).toBe("eski");
    cur = { hi: () => "yeni" };
    expect(p.hi()).toBe("yeni");
  });
});
