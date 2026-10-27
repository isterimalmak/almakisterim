import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { login, makeApp, resetData, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
beforeAll(async () => { ctx = await makeApp(); await resetData(ctx.pool); });
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });
const post = (url: string, cookie: string, payload: unknown) => ctx.app.inject({ method: "POST", url: `/api${url}`, headers: { cookie }, payload: payload as object });
const lastCode = (to: string) => ctx.outbox.sent.filter((m) => m.to === to).at(-1)!.text.match(/\d{6}/)![0];

describe("telefon numarası değiştirme", () => {
  it("önce mevcut numarayla kimlik doğrulanır, sonra yeni numara; eski numaraya bilgi gider; 7 gün beklenir", async () => {
    const cookie = await login(ctx, "05321115001", "Elif Sönmez");
    // Kimlik doğrulanmadan yeni numaraya kod istenemez, doğrudan değiştirilemez.
    expect((await post("/me/phone/code", cookie, { phone: "05321115002" })).json().error).toBe("kimlik_dogrulama_gerekli");
    expect((await post("/me/phone/verify", cookie, { phone: "05321115002", code: "123456" })).json().error).toBe("kimlik_dogrulama_gerekli");
    // E-postası olmayan hesap e-postayla doğrulayamaz.
    expect((await post("/me/phone/change/start", cookie, { via: "email" })).json().error).toBe("eposta_yok");

    expect((await post("/me/phone/change/start", cookie, { via: "sms" })).statusCode).toBe(200);
    expect((await post("/me/phone/change/confirm", cookie, { via: "sms", code: "000000" })).statusCode).toBe(400);
    expect((await post("/me/phone/change/confirm", cookie, { via: "sms", code: lastCode("905321115001") })).json()).toEqual({ ok: true, minutes: 15 });

    // Aynı numara ve başka hesaptaki numara kullanılamaz.
    await login(ctx, "05321115009", "Başka Üye");
    expect((await post("/me/phone/code", cookie, { phone: "05321115001" })).json().error).toBe("ayni_numara");
    expect((await post("/me/phone/code", cookie, { phone: "05321115009" })).json().error).toBe("numara_kullanimda");

    expect((await post("/me/phone/code", cookie, { phone: "0532 111 50 02" })).statusCode).toBe(200);
    expect((await post("/me/phone/verify", cookie, { phone: "05321115002", code: lastCode("905321115002") })).json()).toMatchObject({ ok: true });
    expect((await ctx.app.inject({ url: "/api/me", headers: { cookie } })).json().user.phone).toBe("905321115002");
    // Eski numaraya bilgilendirme SMS'i gider; kayıt tutulur.
    await expect.poll(() => ctx.outbox.sent.filter((m) => m.to === "905321115001").at(-1)?.text).toContain("olarak değiştirildi");
    const row = (await ctx.pool.query("SELECT old_phone, new_phone, identity_via, completed_at IS NOT NULL AS done FROM phone_changes")).rows[0];
    expect(row).toEqual({ old_phone: "905321115001", new_phone: "905321115002", identity_via: "sms", done: true });
    // Yeni numarayla giriş yapılır; eski numara artık bu hesaba girmez (yeni hesap açar).
    const again = await login(ctx, "05321115002", "Elif Sönmez");
    expect((await ctx.app.inject({ url: "/api/me", headers: { cookie: again } })).json().user.name).toBe("Elif Sönmez");
    // 7 gün dolmadan yeniden değiştirilemez.
    expect((await post("/me/phone/change/start", cookie, { via: "sms" })).json().error).toBe("degisiklik_siniri");
  });

  it("e-postası olan üye eski numarasına erişemiyorsa e-postasına gelen kodla doğrular; izin 15 dakika geçerli", async () => {
    const cookie = await login(ctx, "uye@ornek.com", "Can Yıldız");
    await post("/me/phone/code", cookie, { phone: "05321115010" });
    await post("/me/phone/verify", cookie, { phone: "05321115010", code: lastCode("905321115010") });
    expect((await post("/me/phone/change/start", cookie, { via: "email" })).statusCode).toBe(200);
    await post("/me/phone/change/confirm", cookie, { via: "email", code: lastCode("uye@ornek.com") });
    // Süresi geçen izin geçersizdir.
    await ctx.pool.query("UPDATE phone_changes SET identity_at = now() - interval '16 minutes'");
    expect((await post("/me/phone/code", cookie, { phone: "05321115011" })).json().error).toBe("kimlik_dogrulama_gerekli");
  });
});
