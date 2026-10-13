import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createRequest, login, makeApp, resetData, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
beforeEach(async () => {
  ctx ??= await makeApp();
  await resetData(ctx.pool);
});
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });

const post = (cookie: string, id: number, payload: Record<string, unknown>) => ctx.app.inject({ method: "POST", url: `/api/requests/${id}/messages`, headers: { cookie }, payload });
const get = async (cookie: string, id: number) => (await ctx.app.inject({ url: `/api/requests/${id}/messages`, headers: { cookie } })).json();
const me = async (cookie: string) => (await ctx.app.inject({ url: "/api/me", headers: { cookie } })).json().user;

describe("mesajlaşma", () => {
  it("satıcı iletişimi açmadan yazamaz; açınca yazar, alıcı görür ve cevaplar", async () => {
    const buyer = await login(ctx, "05321112233", "Elif Sönmez");
    const id = await createRequest(ctx, buyer);
    const seller = await login(ctx, "05321112244", "Can Yıldız");
    expect((await post(seller, id, { body: "Merhaba" })).json().error).toBe("iletisim_acilmadi");
    expect((await get(seller, id)).can_write).toBe(false);

    await ctx.app.inject({ method: "POST", url: `/api/requests/${id}/unlock`, headers: { cookie: seller } });
    expect((await post(seller, id, { body: "Merhaba, elimde tam istediğiniz ürün var." })).statusCode).toBe(201);
    expect((await me(buyer)).unread_messages).toBe(1);
    expect((await get(seller, id)).messages[0].read).toBe(false);

    const b = await get(buyer, id);
    expect(b.threads).toHaveLength(1);
    expect(b.threads[0]).toMatchObject({ seller_name: "Can Y.", blocked: false });
    expect(b.threads[0].messages[0]).toMatchObject({ mine: false, body: "Merhaba, elimde tam istediğiniz ürün var." });
    expect((await me(buyer)).unread_messages).toBe(0);
    expect((await get(seller, id)).messages[0].read).toBe(true);

    expect((await post(buyer, id, { body: "Fotoğraf atar mısınız?" })).json().error).toBe("satici_gerekli");
    expect((await post(buyer, id, { body: "Fotoğraf atar mısınız?", seller_id: b.threads[0].seller_id })).statusCode).toBe(201);
    const s = await get(seller, id);
    expect(s.messages.map((m: { mine: boolean }) => m.mine)).toEqual([true, false]);

    const list = (await ctx.app.inject({ url: "/api/me/messages", headers: { cookie: seller } })).json().items;
    expect(list[0]).toMatchObject({ request_id: id, role: "satici", other_name: "Elif S.", last_body: "Fotoğraf atar mısınız?" });
  });

  it("alıcı satıcıyı şikâyet edince satıcı yazamaz; alıcı konuşması olmayan satıcıya yazamaz", async () => {
    const buyer = await login(ctx, "05321112233");
    const id = await createRequest(ctx, buyer);
    const seller = await login(ctx, "05321112244");
    const u = (await ctx.app.inject({ method: "POST", url: `/api/requests/${id}/unlock`, headers: { cookie: seller } })).json();
    expect(u).toBeTruthy();
    await post(seller, id, { body: "Merhaba" });
    const unlockId = (await ctx.pool.query("SELECT id FROM contact_unlocks WHERE request_id = $1", [id])).rows[0].id;
    await ctx.app.inject({ method: "POST", url: `/api/unlocks/${unlockId}/report`, headers: { cookie: buyer }, payload: { reason: "rahatsiz_etti", note: "" } });
    expect((await post(seller, id, { body: "Tekrar merhaba" })).json().error).toBe("engellendi");
    expect((await get(buyer, id)).threads[0].blocked).toBe(true);

    const other = await login(ctx, "05321112255");
    const otherId = (await ctx.pool.query("SELECT id FROM users WHERE phone = '905321112255'")).rows[0].id;
    expect((await post(buyer, id, { body: "Selam", seller_id: otherId })).json().error).toBe("konusma_yok");
    expect(other).toBeTruthy();
  });
});
