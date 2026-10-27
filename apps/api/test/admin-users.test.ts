import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { login, makeApp, resetData, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
beforeAll(async () => { ctx = await makeApp(); await resetData(ctx.pool); });
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });
const call = (method: "GET" | "PATCH", url: string, cookie: string, payload?: object) =>
  ctx.app.inject({ method, url: `/api${url}`, headers: { cookie }, ...(payload ? { payload } : {}) });

describe("yönetici üye bilgilerini düzenler", () => {
  it("ad, telefon, e-posta ve kurumsal değişir; neden zorunlu; çakışma ve geçersiz bilgi reddedilir; eski iletişime bilgi gider; geçmiş tutulur", async () => {
    const admin = await login(ctx, "yonetici@almakisterim.com", "Yönetici");
    const member = await login(ctx, "05321116001", "Ayşe Kaya");
    await login(ctx, "05321116002", "Başka Üye");
    await login(ctx, "baska@ornek.com", "E-posta Üye");
    const id = (await call("GET", "/admin/users?q=905321116001", admin)).json().items[0].id as string;

    // Yönetici olmayan düzenleyemez; neden yazılmadan değişiklik yapılmaz.
    expect((await call("PATCH", `/admin/users/${id}`, member, { name: "Hack", note: "kendim değiştiriyorum" })).statusCode).toBe(403);
    expect((await call("PATCH", `/admin/users/${id}`, admin, { name: "Ayşe Yılmaz" })).statusCode).toBe(400);
    expect((await call("PATCH", `/admin/users/${id}`, admin, { name: "Ayşe Kaya", note: "aynı bilgi" })).json().error).toBe("degisiklik_yok");

    // Başka hesaba bağlı numara / e-posta kullanılamaz; geçersiz biçim reddedilir.
    expect((await call("PATCH", `/admin/users/${id}`, admin, { phone: "0532 111 60 02", note: "üye telefonla aradı" })).json().error).toBe("numara_kullanimda");
    expect((await call("PATCH", `/admin/users/${id}`, admin, { email: "BASKA@ornek.com", note: "üye telefonla aradı" })).json().error).toBe("eposta_kullanimda");
    expect((await call("PATCH", `/admin/users/${id}`, admin, { phone: "12345", note: "üye telefonla aradı" })).json().error).toBe("gecersiz_numara");
    expect((await call("PATCH", `/admin/users/${id}`, admin, { phone: "", note: "üye telefonla aradı" })).json().error).toBe("iletisim_gerekli");

    // Geçerli değişiklik: ad, yeni numara, e-posta, kurumsal; üyenin oturumu kapatılır.
    const ok = await call("PATCH", `/admin/users/${id}`, admin, { name: "Ayşe Yılmaz", phone: "0532 111 60 09", email: "Ayse@Ornek.com", is_corporate: true, note: "Kimlik belgesiyle başvurdu, eski hattı kayboldu", logout: true });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().changed).toEqual(["Ad soyad", "E-posta", "Telefon", "Kurumsal"]);
    expect((await call("GET", "/me", member)).json().user).toBeNull();
    // Eski numaraya bilgi SMS'i gider.
    await expect.poll(() => ctx.outbox.last("905321116001")?.text).toContain("destek ekibimiz tarafından değiştirildi");

    // Üye yeni numarayla girer ve aynı hesaba ulaşır.
    const again = await login(ctx, "05321116009");
    expect((await call("GET", "/me", again)).json().user).toMatchObject({ id, name: "Ayşe Yılmaz", email: "ayse@ornek.com", is_corporate: true });

    // Üye kartında değişiklik geçmişi: kim, neden, eski ve yeni değer.
    const card = (await call("GET", `/admin/users/${id}`, admin)).json();
    expect(card.user).toMatchObject({ phone: "905321116009", email: "ayse@ornek.com" });
    expect(card.edits).toHaveLength(4);
    expect(card.edits.find((e: { field: string }) => e.field === "phone")).toMatchObject({ old_value: "905321116001", new_value: "905321116009", note: "Kimlik belgesiyle başvurdu, eski hattı kayboldu", admin_name: "Yönetici" });

    // E-posta değişince eski e-postaya da bilgi gider; e-posta kaldırılabilir (telefon kaldığı için).
    await call("PATCH", `/admin/users/${id}`, admin, { email: "", note: "Üye e-postasının silinmesini istedi" });
    await expect.poll(() => ctx.outbox.last("ayse@ornek.com")?.text).toContain("e-posta adresi destek ekibimiz tarafından değiştirildi");
    expect((await call("GET", `/admin/users/${id}`, admin)).json().user.email).toBeNull();
  });
});
