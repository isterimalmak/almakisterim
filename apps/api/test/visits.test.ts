import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { login, makeApp, resetData, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
beforeAll(async () => { ctx = await makeApp(); await resetData(ctx.pool); });
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });

describe("Yönetim → Ziyaretçiler", () => {
  it("sayfa kayıtları, çıkış süreleri ve girişler; ziyaretçinin yolu sırasıyla; bot ve geçersiz kayıt alınmaz; yalnız yönetici görür", async () => {
    const admin = await login(ctx, "yonetici@almakisterim.com", "Yönetici");
    const member = await login(ctx, "05321119001", "Gezen Üye");
    const track = (payload: Record<string, unknown>, headers: Record<string, string> = {}) =>
      ctx.app.inject({ method: "POST", url: "/api/track", headers: { "user-agent": "Mozilla/5.0 (iPhone)", ...headers }, payload });
    const anon = "a".repeat(20), mem = "b".repeat(20);

    // Üye olmayan ziyaretçi: Google'dan gelir, iki sayfa gezer; ilk sayfada 12 sn kalır.
    const v1 = (await track({ visitor: anon, path: "/nakit-araba-alanlar?utm=x", ref: "www.google.com", device: "mobil" })).json().id;
    expect((await ctx.app.inject({ method: "POST", url: "/api/track/leave", payload: { id: v1, visitor: anon, ms: 12000 } })).statusCode).toBe(200);
    // Süre ikinci kez yazılmaz; başka ziyaretçinin kaydına yazılamaz (sekme kapanırken düz metin olarak da gelir).
    await ctx.app.inject({ method: "POST", url: "/api/track/leave", payload: { id: v1, visitor: anon, ms: 99999 } });
    await ctx.app.inject({ method: "POST", url: "/api/track/leave", headers: { "content-type": "text/plain" }, payload: JSON.stringify({ id: v1, visitor: mem, ms: 5 }) });
    await track({ visitor: anon, path: "/kategori/vasita" });
    // Üye: giriş yapmış hâlde gezer.
    await track({ visitor: mem, path: "/talep-ver", device: "masaustu" }, { cookie: member });
    // Çıkış bildirimi gelmeden sonraki sayfaya geçilirse önceki sayfanın süresi geçişten hesaplanır.
    const quick = "c".repeat(20);
    const q1 = (await track({ visitor: quick, path: "/" })).json().id;
    await ctx.pool.query("UPDATE visits SET created_at = now() - interval '7 seconds' WHERE id = $1", [q1]);
    await track({ visitor: quick, path: "/kategori" });
    const qd = (await ctx.pool.query<{ duration_ms: number }>("SELECT duration_ms FROM visits WHERE id = $1", [q1])).rows[0]!.duration_ms;
    expect(qd).toBeGreaterThanOrEqual(7000);
    expect(qd).toBeLessThan(60000);
    await ctx.pool.query("DELETE FROM visits WHERE visitor = $1", [quick]);
    // Bot ve geçersiz yol/numara kaydedilmez.
    expect((await track({ visitor: anon, path: "/" }, { "user-agent": "Googlebot/2.1" })).json().id).toBeNull();
    expect((await track({ visitor: "kisa", path: "/" })).statusCode).toBe(400);
    expect((await track({ visitor: anon, path: "javascript:alert(1)" })).statusCode).toBe(400);

    const r = (await ctx.app.inject({ url: "/api/admin/visits?days=1", headers: { cookie: admin } })).json();
    expect(r.summary).toMatchObject({ visitors: 2, members: 1, views: 3, avg_ms: 12000 });
    // Girişler: login() iki giriş yaptı (yönetici ve üye).
    expect(r.summary.logins).toBe(2);
    expect(r.logins.map((x: { name: string }) => x.name).sort()).toEqual(["Gezen Üye", "Yönetici"]);
    const a = r.sessions.find((s: { visitor: string }) => s.visitor === anon);
    expect(a).toMatchObject({ member: false, views: 2, entry: "/nakit-araba-alanlar", exit: "/kategori/vasita", ref: "www.google.com", device: "mobil", total_ms: 12000 });
    expect(r.sessions.find((s: { visitor: string }) => s.visitor === mem)).toMatchObject({ member: true, name: "Gezen Üye", entry: "/talep-ver" });
    expect(r.pages[0]).toHaveProperty("path");
    // Üye adına göre süzme
    const f = (await ctx.app.inject({ url: `/api/admin/visits?days=1&q=${encodeURIComponent("Gezen")}`, headers: { cookie: admin } })).json();
    expect(f.sessions.map((s: { visitor: string }) => s.visitor)).toEqual([mem]);
    expect(f.logins).toHaveLength(1);
    // Ziyaretçinin yolu (giriş → çıkış)
    const path = (await ctx.app.inject({ url: `/api/admin/visits/${anon}`, headers: { cookie: admin } })).json().items;
    expect(path.map((x: { path: string; duration_ms: number | null }) => [x.path, x.duration_ms])).toEqual([["/nakit-araba-alanlar", 12000], ["/kategori/vasita", null]]);

    expect((await ctx.app.inject({ url: "/api/admin/visits", headers: { cookie: member } })).statusCode).toBe(403);
    expect((await ctx.app.inject({ url: `/api/admin/visits/${anon}`, headers: { cookie: member } })).statusCode).toBe(403);
    // Hesap silinince ziyaret ve giriş kayıtları da silinir.
    expect((await ctx.app.inject({ method: "DELETE", url: "/api/me", headers: { cookie: member }, payload: { onay: "SİL" } })).statusCode).toBe(200);
    expect((await ctx.pool.query("SELECT count(*)::int AS n FROM visits v JOIN users u ON u.id = v.user_id WHERE u.name = 'Silinmiş üye'")).rows[0].n).toBe(0);
  });
});
