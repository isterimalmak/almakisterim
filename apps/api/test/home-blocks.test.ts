import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { login, makeApp, resetData, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
beforeEach(async () => {
  ctx ??= await makeApp();
  await resetData(ctx.pool);
  await ctx.pool.query("DELETE FROM settings WHERE key = 'home_blocks'");
});
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });

const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(300).fill(7)]);
async function upload(cookie: string) {
  const t = await ctx.app.inject({ method: "POST", url: "/api/media/uploads", headers: { cookie }, payload: { content_type: "image/jpeg", size: JPG.length } });
  const { id, upload: up } = t.json();
  await ctx.app.inject({ method: "PUT", url: up.url, headers: { "content-type": "image/jpeg" }, payload: JPG });
  return (await ctx.app.inject({ method: "POST", url: `/api/media/${id}/complete`, headers: { cookie } })).json() as { id: string };
}
const cats = async () => (await ctx.app.inject({ url: "/api/categories" })).json();

describe("ana sayfa bölümleri", () => {
  it("logonun yanındaki ad yönetimden değişir; boş ya da çok uzun ad kabul edilmez", async () => {
    expect((await cats()).site_name).toBe("almakisterim.com");
    const admin = await login(ctx, "yonetici@almakisterim.com");
    const put = (site_name: string) => ctx.app.inject({ method: "PUT", url: "/api/admin/settings", headers: { cookie: admin }, payload: { site_name } });
    expect((await put("  Almak İsterim  ")).statusCode).toBe(200);
    expect((await cats()).site_name).toBe("Almak İsterim");
    expect((await put("a")).statusCode).toBe(400);
    expect((await put("x".repeat(41))).statusCode).toBe(400);
  });

  it("varsayılan liste eski ayarlardan kurulur; yan kutular dahil bütün hazır bölümler vardır", async () => {
    await ctx.pool.query("UPDATE settings SET value = 'false' WHERE key = 'home_vitrin'");
    await ctx.pool.query(`UPDATE settings SET value = '["latest", "hero"]' WHERE key = 'home_order'`);
    const b = (await cats()).home_blocks;
    expect(b.map((x: { id: string }) => x.id)).toEqual(["latest", "hero", "urgent", "cats", "ads_m", "center_ads", "vitrin", "corp", "launch", "how", "safe"]);
    expect(b.find((x: { id: string }) => x.id === "vitrin").hidden).toBe(true);
  });

  it("yönetici sırayı değiştirir, yazı/kayan yazı/afiş ekler; geçersiz bölüm reddedilir; kullanılmayan afiş görseli silinir", async () => {
    const admin = await login(ctx, "yonetici@almakisterim.com");
    const put = (blocks: unknown[]) => ctx.app.inject({ method: "PUT", url: "/api/admin/home-blocks", headers: { cookie: admin }, payload: { blocks } });
    const user = await login(ctx, "05321112233");
    expect((await ctx.app.inject({ method: "PUT", url: "/api/admin/home-blocks", headers: { cookie: user }, payload: { blocks: [] } })).statusCode).toBe(403);

    const ad = (await ctx.app.inject({ method: "POST", url: "/api/admin/tanitim", headers: { cookie: admin }, payload: { media_id: (await upload(admin)).id, placement: "blok", link_url: "/talep-ver" } })).json();
    const blocks = [
      { type: "builtin", id: "safe", hidden: false },
      { type: "text", id: "yazi_1", title: "Hoş geldiniz", text: "Almak istediğinizi yazın.", cta: "Talep ver", href: "/talep-ver", tone: "turuncu" },
      { type: "marquee", id: "bant_1", text: "Ücretsiz talep ver", bg: "#F26B1D", fg: "#FFFFFF", href: null },
      { type: "banner", id: "afis_1", ad_ids: [ad.id] },
      { type: "builtin", id: "hero", hidden: true },
    ];
    const r = await put(blocks);
    expect(r.statusCode, r.body).toBe(200);
    const saved = (await cats()).home_blocks;
    // Listede olmayan hazır bölümler sona eklenir.
    expect(saved.slice(0, 5).map((x: { id: string }) => x.id)).toEqual(["safe", "yazi_1", "bant_1", "afis_1", "hero"]);
    expect(saved).toHaveLength(14);
    expect(saved[1]).toMatchObject({ title: "Hoş geldiniz", tone: "turuncu", align: "orta", hidden: false });
    expect(saved[4].hidden).toBe(true);
    // Afiş görseli yönetimdeki reklam listesinde görünmez, herkese açık listede "blok" olarak döner.
    expect((await ctx.app.inject({ url: "/api/admin/tanitim", headers: { cookie: admin } })).json().items).toHaveLength(0);
    expect((await ctx.app.inject({ url: "/api/tanitim" })).json().blok.map((x: { id: number }) => x.id)).toEqual([ad.id]);

    expect((await put([{ type: "builtin", id: "uydurma" }])).statusCode).toBe(400);
    expect((await put([{ type: "text", id: "a1" }, { type: "text", id: "a1" }])).json().error).toBe("tekrar");
    expect((await put([{ type: "banner", id: "afis_2", ad_ids: [999999] }])).json().error).toBe("gorsel_yok");
    expect((await put([{ type: "text", id: "y_2", href: "javascript:alert(1)" }])).statusCode).toBe(400);

    // Afiş silinince görseli (bir saatten eskiyse) silinir.
    await ctx.pool.query("UPDATE ads SET created_at = now() - interval '2 hours'");
    expect((await put(blocks.filter((b) => b.type !== "banner"))).statusCode).toBe(200);
    expect((await ctx.pool.query("SELECT count(*)::int AS n FROM ads")).rows[0].n).toBe(0);
  });
});
