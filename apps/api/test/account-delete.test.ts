import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequest, login, makeApp, resetData, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
beforeEach(async () => {
  ctx ??= await makeApp();
  await resetData(ctx.pool);
});
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });

const del = (cookie: string, payload: unknown) => ctx.app.inject({ method: "DELETE", url: "/api/me", headers: { cookie }, payload: payload as object });

describe("hesap silme", () => {
  it("üye SİL yazarak hesabını siler: kişisel bilgiler gider, talep kapanır, oturum düşer, onay e-postası gelir; aynı numarayla yeniden üye olunur", async () => {
    await ctx.pool.query("UPDATE settings SET value = 'false' WHERE key = 'phone_required'");
    const cookie = await login(ctx, "silinecek@ornek.com", "Deniz Kaya");
    const id = await createRequest(ctx, cookie);
    await ctx.app.inject({ method: "POST", url: "/api/me/alarms", headers: { cookie }, payload: { category_id: "elektronik", city: "İstanbul" } });

    expect((await del(cookie, {})).statusCode).toBe(400);
    expect((await del(cookie, { onay: "sil" })).statusCode).toBe(400);
    const r = await del(cookie, { onay: "SİL" });
    expect(r.statusCode, r.body).toBe(200);

    const u = (await ctx.pool.query("SELECT email, phone, google_sub, name, deleted_at FROM users WHERE name = 'Silinmiş üye'")).rows[0];
    expect(u).toMatchObject({ email: null, phone: null, google_sub: null });
    expect(u.deleted_at).toBeTruthy();
    expect((await ctx.pool.query("SELECT status FROM requests WHERE id = $1", [id])).rows[0].status).toBe("closed");
    expect((await ctx.pool.query("SELECT count(*)::int AS n FROM alarms")).rows[0].n).toBe(0);
    expect((await ctx.app.inject({ url: "/api/me", headers: { cookie } })).json().user).toBeNull();
    await vi.waitFor(() => expect(ctx.outbox.last("silinecek@ornek.com")?.subject).toBe("Hesabınız silindi"));

    // Aynı adresle yeni, boş bir hesap açılır.
    const again = await login(ctx, "silinecek@ornek.com", "Deniz Yeni");
    const me = (await ctx.app.inject({ url: "/api/me", headers: { cookie: again } })).json().user;
    expect(me).toMatchObject({ email: "silinecek@ornek.com", name: "Deniz Yeni" });
    expect((await ctx.app.inject({ url: "/api/me/requests", headers: { cookie: again } })).json().items).toHaveLength(0);
  });

  it("girişsiz ve yönetici hesabı silinemez", async () => {
    expect((await ctx.app.inject({ method: "DELETE", url: "/api/me", payload: { onay: "SİL" } })).statusCode).toBe(401);
    const admin = await login(ctx, "yonetici@almakisterim.com");
    expect((await del(admin, { onay: "SİL" })).json().error).toBe("yonetici_silinemez");
  });

  it("yönetici üyeyi nedeniyle siler: kişisel bilgiler gider, oturum düşer, üyeye e-posta gider, üye kartında kayıt kalır; yönetici silinemez", async () => {
    await ctx.pool.query("UPDATE settings SET value = 'false' WHERE key = 'phone_required'");
    const admin = await login(ctx, "yonetici@almakisterim.com");
    const cookie = await login(ctx, "uye-sil@ornek.com", "Ece Demir");
    const reqId = await createRequest(ctx, cookie);
    const uid = (await ctx.pool.query("SELECT id FROM users WHERE email = 'uye-sil@ornek.com'")).rows[0].id;
    const aid = (await ctx.pool.query("SELECT id FROM users WHERE email = 'yonetici@almakisterim.com'")).rows[0].id;
    const adel = (id: string, payload: object, c = admin) => ctx.app.inject({ method: "DELETE", url: `/api/admin/users/${id}`, headers: { cookie: c }, payload });

    expect((await adel(uid, { onay: "SİL", note: "Üye istedi" }, cookie)).statusCode).toBe(403);
    expect((await adel(uid, { onay: "SİL" })).statusCode).toBe(400);
    expect((await adel(uid, { onay: "sil", note: "Üye e-postayla istedi" })).statusCode).toBe(400);
    expect((await adel(aid, { onay: "SİL", note: "Deneme silme" })).statusCode).toBe(409);

    const r = await adel(uid, { onay: "SİL", note: "Üye e-postayla istedi" });
    expect(r.statusCode, r.body).toBe(200);
    expect((await ctx.pool.query("SELECT email, name, deleted_at FROM users WHERE id = $1", [uid])).rows[0]).toMatchObject({ email: null, name: "Silinmiş üye" });
    expect((await ctx.pool.query("SELECT status FROM requests WHERE id = $1", [reqId])).rows[0].status).toBe("closed");
    expect((await ctx.app.inject({ url: "/api/me", headers: { cookie } })).json().user).toBeNull();
    await vi.waitFor(() => expect(ctx.outbox.last("uye-sil@ornek.com")?.subject).toBe("Hesabınız silindi"));
    const card = (await ctx.app.inject({ url: `/api/admin/users/${uid}`, headers: { cookie: admin } })).json();
    expect(card.user.deleted_at).toBeTruthy();
    expect(card.edits[0]).toMatchObject({ field: "hesap", old_value: "Ece Demir", new_value: "Silindi", note: "Üye e-postayla istedi" });
    expect((await adel(uid, { onay: "SİL", note: "Tekrar silme" })).statusCode).toBe(400);
  });
});
