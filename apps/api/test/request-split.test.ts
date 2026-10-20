import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { login, makeApp, resetData, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
beforeEach(async () => {
  ctx ??= await makeApp();
  await resetData(ctx.pool);
});
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });

const userId = async (phone: string) => (await ctx.pool.query("SELECT id FROM users WHERE phone = $1", [phone])).rows[0].id as string;
const photo = async (owner: string, n: number) => (await ctx.pool.query<{ id: string }>(
  "INSERT INTO media (owner_id, kind, storage_key, content_type, size_bytes, status) VALUES ($1, 'image', $2, 'image/png', 10, 'ready') RETURNING id", [owner, `t/${owner}-${n}.png`])).rows[0]!.id;
const car = { category_id: "otomobil", title: "Dizel aile arabası arıyorum", description: "Hasarsız, bakımlı olsun.", condition: "İkinci El", city: "İstanbul", district: "", budget_max: 1500000, contact_consent: true };

describe("birden fazla araçlı talep", () => {
  it("her araç kendi görselleriyle ayrı talep olur; açık talep sınırında tek sayılır; talep sayfası diğerlerini gösterir", async () => {
    const buyer = await login(ctx, "05321119901", "Elif Sönmez");
    const uid = await userId("905321119901");
    const [p1, p2, p3] = [await photo(uid, 1), await photo(uid, 2), await photo(uid, 3)];
    const r = await ctx.app.inject({ method: "POST", url: "/api/requests", headers: { cookie: buyer }, payload: {
      ...car, attrs: { araclar: [{ marka: "BMW", model: "3 Serisi" }, { marka: "Audi", model: "A4" }, { marka: "Toyota", model: null }], yil_min: 2018, yakit: ["Dizel"] },
      media_ids: [], vehicle_media: { "BMW|3 Serisi": [p1], "Audi|A4": [p2, p3] },
    } });
    expect(r.statusCode, r.body).toBe(201);
    const { ids } = r.json();
    expect(ids).toHaveLength(3);
    const rows = (await ctx.pool.query("SELECT id, title, attrs, group_id, (SELECT count(*)::int FROM media m WHERE m.request_id = r.id) AS photos FROM requests r ORDER BY id")).rows;
    expect(rows.map((x) => x.attrs.araclar)).toEqual([[{ marka: "BMW", model: "3 Serisi" }], [{ marka: "Audi", model: "A4" }], [{ marka: "Toyota", model: null }]]);
    expect(rows.map((x) => x.photos)).toEqual([1, 2, 0]);
    expect(rows.every((x) => x.attrs.yil_min === 2018 && x.attrs.yakit[0] === "Dizel")).toBe(true);
    expect(new Set(rows.map((x) => x.group_id)).size).toBe(1);
    expect(rows[0].title).toContain("BMW 3 Serisi");
    expect(rows[1].title).toContain("Audi A4");

    // Satıcı yalnızca kendi aracına uyan talebi görür.
    const list = (await ctx.app.inject({ url: "/api/requests?arac_marka=Audi&arac_model=A4" })).json();
    expect(list.items.map((x: { id: number }) => x.id)).toEqual([ids[1]]);
    const d = (await ctx.app.inject({ url: `/api/requests/${ids[0]}` })).json().request;
    expect(d.group.map((x: { id: number }) => x.id)).toEqual([ids[1], ids[2]]);

    // 5 açık talep sınırı: üç araçlık gönderim tek talep sayılır.
    for (let i = 0; i < 4; i++) {
      const x = await ctx.app.inject({ method: "POST", url: "/api/requests", headers: { cookie: buyer }, payload: { ...car, title: `Tek araç talebim ${i}`, attrs: { araclar: [{ marka: "Fiat", model: "Egea" }] }, media_ids: [] } });
      expect(x.statusCode, x.body).toBe(201);
    }
    const over = await ctx.app.inject({ method: "POST", url: "/api/requests", headers: { cookie: buyer }, payload: { ...car, attrs: {}, media_ids: [] } });
    expect(over.json().error).toBe("talep_siniri");
  });

  it("fotoğraf zorunluysa her araç için ayrı fotoğraf istenir; aynı fotoğraf iki araca eklenemez", async () => {
    await ctx.pool.query("UPDATE settings SET value = 'true' WHERE key = 'photo_required'");
    const buyer = await login(ctx, "05321119902");
    const uid = await userId("905321119902");
    const p1 = await photo(uid, 1);
    const attrs = { araclar: [{ marka: "BMW", model: "3 Serisi" }, { marka: "Audi", model: "A4" }] };
    const a = await ctx.app.inject({ method: "POST", url: "/api/requests", headers: { cookie: buyer }, payload: { ...car, attrs, media_ids: [], vehicle_media: { "BMW|3 Serisi": [p1] } } });
    expect(a.json()).toMatchObject({ error: "fotograf_gerekli", message: expect.stringContaining("Audi A4") });
    const b = await ctx.app.inject({ method: "POST", url: "/api/requests", headers: { cookie: buyer }, payload: { ...car, attrs, media_ids: [], vehicle_media: { "BMW|3 Serisi": [p1], "Audi|A4": [p1] } } });
    expect(b.json().error).toBe("medya_gecersiz");
    expect((await ctx.pool.query("SELECT count(*)::int AS n FROM requests")).rows[0].n).toBe(0);
  });
});
