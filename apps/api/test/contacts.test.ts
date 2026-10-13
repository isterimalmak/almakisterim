import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createRequest, login, makeApp, postOffer, resetData, sampleRequest, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
beforeEach(async () => {
  ctx ??= await makeApp();
  await resetData(ctx.pool);
});
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });

const unlock = (cookie: string, id: number) => ctx.app.inject({ method: "POST", url: `/api/requests/${id}/unlock`, headers: { cookie } });
const detail = async (id: number, cookie?: string) => (await ctx.app.inject({ url: `/api/requests/${id}`, headers: cookie ? { cookie } : {} })).json();
const setting = (key: string, value: unknown) => ctx.pool.query("UPDATE settings SET value = $2 WHERE key = $1", [key, JSON.stringify(value)]);

describe("numarayı gör", () => {
  it("satıcı numarayı açar; numarayı yalnızca o görür, alıcı kimin gördüğünü görür", async () => {
    const buyer = await login(ctx, "05321112233", "Elif Sönmez");
    const seller = await login(ctx, "05321112244", "Ahmet Kaya");
    const other = await login(ctx, "05321112255");
    const id = await createRequest(ctx, buyer);

    const before = await detail(id, seller);
    expect(before.contact).toMatchObject({ unlocked: false, phone: null, price: 3, slots_left: 10 });
    expect(JSON.stringify(await detail(id))).not.toContain("905321112233");

    const r = await unlock(seller, id);
    expect(r.statusCode).toBe(201);
    expect(r.json()).toMatchObject({ phone: "905321112233", free: true, charged_credits: 0 });
    // Tekrar açmak ücretsizdir ve hak harcamaz.
    expect((await unlock(seller, id)).statusCode).toBe(200);
    expect((await ctx.pool.query("SELECT count(*)::int AS n FROM contact_unlocks")).rows[0].n).toBe(1);

    expect((await detail(id, seller)).contact).toMatchObject({ unlocked: true, phone: "905321112233", slots_left: 9 });
    expect((await detail(id, other)).contact).toMatchObject({ unlocked: false, phone: null });
    expect((await detail(id, other)).contact.viewers).toBeUndefined();
    expect((await detail(id, buyer)).contact.viewers).toEqual([expect.objectContaining({ seller_name: "Ahmet K." })]);
    expect((await unlock(buyer, id)).statusCode).toBe(400);
  });

  it("ücretsiz hak bitince kredi düşer, kredi yetmezse 402; kategori fiyatı uygulanır", async () => {
    await setting("free_unlocks_per_month", 1);
    await setting("unlock_price_by_top", { elektronik: 3 });
    const buyer = await login(ctx, "05321112233");
    const seller = await login(ctx, "05321112244");
    const ids = [await createRequest(ctx, buyer), await createRequest(ctx, buyer), await createRequest(ctx, buyer)];

    expect((await unlock(seller, ids[0]!)).json()).toMatchObject({ free: true });
    const no = await unlock(seller, ids[1]!);
    expect(no.statusCode).toBe(402);
    expect(no.json().message).toContain("3 kredi");

    await ctx.pool.query("UPDATE users SET credits = 4 WHERE phone = '905321112244'");
    expect((await unlock(seller, ids[1]!)).json()).toMatchObject({ free: false, charged_credits: 3 });
    expect((await ctx.pool.query("SELECT credits FROM users WHERE phone = '905321112244'")).rows[0].credits).toBe(1);
    expect((await ctx.pool.query("SELECT delta, reason, ref FROM credit_ledger")).rows).toEqual([{ delta: -3, reason: "numara", ref: `request:${ids[1]}` }]);
    expect((await unlock(seller, ids[2]!)).statusCode).toBe(402);
    expect((await ctx.app.inject({ url: "/api/me", headers: { cookie: seller } })).json().user.free_unlocks_left).toBe(0);
  });

  it("bir talepte numarayı en fazla N satıcı görebilir", async () => {
    await setting("unlock_limit_per_request", 2);
    const buyer = await login(ctx, "05321112233");
    const id = await createRequest(ctx, buyer);
    for (const p of ["05321112244", "05321112255"]) expect((await unlock(await login(ctx, p), id)).statusCode).toBe(201);
    const third = await unlock(await login(ctx, "05321112266"), id);
    expect(third.statusCode).toBe(409);
    expect(third.json().error).toBe("sinir_doldu");
    expect((await detail(id)).contact.slots_left).toBe(0);
  });

  it("talep kapanınca numara gizlenir, teklifi kabul edilen satıcıda açık kalır", async () => {
    const buyer = await login(ctx, "05321112233");
    const s1 = await login(ctx, "05321112244");
    const s2 = await login(ctx, "05321112255");
    const id = await createRequest(ctx, buyer);
    const o1 = (await postOffer(ctx, s1, id, { price: 18000 })).json().id;
    await postOffer(ctx, s2, id, { price: 19000 });
    await ctx.app.inject({ method: "POST", url: `/api/offers/${o1}/accept`, headers: { cookie: buyer } });
    expect((await detail(id, s1)).contact.phone).toBe("905321112233");
    expect((await detail(id, s2)).contact.phone).toBeNull();
    // Kapanan talep yeni satıcıya açılmaz.
    expect((await unlock(await login(ctx, "05321112266"), id)).statusCode).toBe(409);
  });

  it("talep vermek için doğrulanmış telefon ve paylaşım onayı gerekir", async () => {
    const mailUser = await login(ctx, "elif@example.com");
    const noPhone = await ctx.app.inject({ method: "POST", url: "/api/requests", headers: { cookie: mailUser }, payload: sampleRequest });
    expect(noPhone.statusCode).toBe(409);
    expect(noPhone.json().error).toBe("telefon_gerekli");

    const phoneUser = await login(ctx, "05321112233");
    const noConsent = await ctx.app.inject({ method: "POST", url: "/api/requests", headers: { cookie: phoneUser }, payload: { ...sampleRequest, contact_consent: false } });
    expect(noConsent.statusCode).toBe(400);
    const id = await createRequest(ctx, phoneUser);
    expect((await ctx.pool.query("SELECT contact_consent_at IS NOT NULL AS ok FROM requests WHERE id = $1", [id])).rows[0].ok).toBe(true);
  });

  it("e-posta ile giren kullanıcı SMS koduyla telefon ekler; başkasının numarası eklenemez", async () => {
    const u = await login(ctx, "elif@example.com");
    const c = await ctx.app.inject({ method: "POST", url: "/api/me/phone/code", headers: { cookie: u }, payload: { phone: "0532 111 22 77" } });
    expect(c.statusCode).toBe(200);
    const code = ctx.outbox.last("905321112277")!.text.match(/\d{6}/)![0];
    const bad = await ctx.app.inject({ method: "POST", url: "/api/me/phone/verify", headers: { cookie: u }, payload: { phone: "05321112277", code: code === "000000" ? "111111" : "000000" } });
    expect(bad.statusCode).toBe(400);
    const ok = await ctx.app.inject({ method: "POST", url: "/api/me/phone/verify", headers: { cookie: u }, payload: { phone: "05321112277", code } });
    expect(ok.statusCode).toBe(200);
    expect((await ctx.app.inject({ url: "/api/me", headers: { cookie: u } })).json().user.phone).toBe("905321112277");
    expect((await createRequest(ctx, u))).toBeGreaterThan(0);

    await login(ctx, "05321112288");
    const other = await login(ctx, "mehmet@example.com");
    const taken = await ctx.app.inject({ method: "POST", url: "/api/me/phone/code", headers: { cookie: other }, payload: { phone: "05321112288" } });
    expect(taken.statusCode).toBe(409);
  });
});

describe("telefon zorunluluğu kapalıyken", () => {
  it("yönetici kapatınca telefonsuz talep verilir; satıcı ücretsiz açar ve numara yerine teklif yolu görünür", async () => {
    const admin = await login(ctx, "yonetici@almakisterim.com");
    const put = await ctx.app.inject({ method: "PUT", url: "/api/admin/settings", headers: { cookie: admin }, payload: { phone_required: false } });
    expect(put.statusCode, put.body).toBe(200);
    expect((await ctx.app.inject({ url: "/api/categories" })).json().phone_required).toBe(false);

    const buyer = await login(ctx, "elif@example.com");
    const id = await createRequest(ctx, buyer);
    const seller = await login(ctx, "satici@example.com");
    const before = (await ctx.pool.query("SELECT credits FROM users WHERE email = 'satici@example.com'")).rows[0].credits;
    const r = await unlock(seller, id);
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json()).toMatchObject({ phone: null, charged_credits: 0, free: false });
    expect((await ctx.pool.query("SELECT credits FROM users WHERE email = 'satici@example.com'")).rows[0].credits).toBe(before);
    const c = (await detail(id, seller)).contact;
    expect(c).toMatchObject({ unlocked: true, phone: null });
    // Telefonu olan alıcıda numara yine görünür ve ücret kuralları geçerlidir.
    const pBuyer = await login(ctx, "05321112233");
    const id2 = await createRequest(ctx, pBuyer);
    expect((await unlock(seller, id2)).json().phone).toBe("905321112233");

    // Tekrar açınca eski kurallar döner.
    await ctx.app.inject({ method: "PUT", url: "/api/admin/settings", headers: { cookie: admin }, payload: { phone_required: true } });
    expect((await ctx.app.inject({ method: "POST", url: "/api/requests", headers: { cookie: buyer }, payload: sampleRequest })).json().error).toBe("telefon_gerekli");
  });
});

describe("numara güvenliği", () => {
  it("satıcının telefonu doğrulanmamışsa numara açamaz", async () => {
    const buyer = await login(ctx, "05321112233");
    const id = await createRequest(ctx, buyer);
    const mailSeller = await login(ctx, "satici@example.com");
    const r = await unlock(mailSeller, id);
    expect(r.statusCode).toBe(409);
    expect(r.json().error).toBe("telefon_gerekli");
  });

  it("fiyat bütçe kademesine göre; kategoriye özel fiyat önceliklidir", async () => {
    const buyer = await login(ctx, "05321112233");
    const cheap = await createRequest(ctx, buyer, { budget_min: 500, budget_max: 900 });
    const mid = await createRequest(ctx, buyer);
    const big = await createRequest(ctx, buyer, { budget_min: 1_000_000, budget_max: 1_500_000 });
    expect((await detail(cheap)).contact.price).toBe(1);
    expect((await detail(mid)).contact.price).toBe(3);
    expect((await detail(big)).contact.price).toBe(5);
    await setting("unlock_price_by_top", { elektronik: 2 });
    expect((await detail(big)).contact.price).toBe(2);
  });

  it("alıcı aynı anda en fazla N açık talep verebilir", async () => {
    await setting("max_active_requests_per_user", 2);
    const buyer = await login(ctx, "05321112233");
    const a = await createRequest(ctx, buyer);
    await createRequest(ctx, buyer);
    const third = await ctx.app.inject({ method: "POST", url: "/api/requests", headers: { cookie: buyer }, payload: sampleRequest });
    expect(third.statusCode).toBe(409);
    expect(third.json().error).toBe("talep_siniri");
    await ctx.app.inject({ method: "POST", url: `/api/requests/${a}/close`, headers: { cookie: buyer }, payload: {} });
    expect(await createRequest(ctx, buyer)).toBeGreaterThan(0);
  });

  it("numara açılınca alıcıya site içi bildirim gider", async () => {
    const buyer = await login(ctx, "05321112233");
    const seller = await login(ctx, "05321112244");
    const id = await createRequest(ctx, buyer);
    await unlock(seller, id);
    const me = (await ctx.app.inject({ url: "/api/me", headers: { cookie: buyer } })).json().user;
    expect(me.unread_notifications).toBe(1);
    const n = (await ctx.app.inject({ url: "/api/me/notifications", headers: { cookie: buyer } })).json().items;
    expect(n[0]).toMatchObject({ link: `/talep/${id}` });
    expect(n[0].text).toContain("numaranızı gördü");
    await ctx.app.inject({ method: "POST", url: "/api/me/notifications/read", headers: { cookie: buyer }, payload: {} });
    expect((await ctx.app.inject({ url: "/api/me", headers: { cookie: buyer } })).json().user.unread_notifications).toBe(0);
  });

  it("alıcı numarasını gizleyince kimse göremez ve yeni satıcı açamaz; yeniden açabilir", async () => {
    const buyer = await login(ctx, "05321112233");
    const seller = await login(ctx, "05321112244");
    const id = await createRequest(ctx, buyer);
    await unlock(seller, id);
    const hide = await ctx.app.inject({ method: "POST", url: `/api/requests/${id}/contact`, headers: { cookie: seller }, payload: { hidden: true } });
    expect(hide.statusCode).toBe(404);
    await ctx.app.inject({ method: "POST", url: `/api/requests/${id}/contact`, headers: { cookie: buyer }, payload: { hidden: true } });
    expect((await detail(id, seller)).contact).toMatchObject({ phone: null, blocked: true, hidden: true });
    expect((await unlock(await login(ctx, "05321112255"), id)).json().error).toBe("numara_gizli");
    expect((await ctx.app.inject({ url: "/api/me/unlocks", headers: { cookie: seller } })).json().items[0]).toMatchObject({ phone: null, phone_note: "Alıcı numarasını paylaşmayı durdurdu" });
    await ctx.app.inject({ method: "POST", url: `/api/requests/${id}/contact`, headers: { cookie: buyer }, payload: { hidden: false } });
    expect((await detail(id, seller)).contact.phone).toBe("905321112233");
  });

  it("alıcı rahatsız eden satıcıyı şikâyet edince numara o satıcıdan gizlenir, teklif veremez", async () => {
    const buyer = await login(ctx, "05321112233");
    const seller = await login(ctx, "05321112244");
    const id = await createRequest(ctx, buyer);
    await unlock(seller, id);
    const viewer = (await detail(id, buyer)).contact.viewers[0];
    const wrong = await ctx.app.inject({ method: "POST", url: `/api/unlocks/${viewer.unlock_id}/report`, headers: { cookie: buyer }, payload: { reason: "ulasilamiyor" } });
    expect(wrong.statusCode).toBe(400);
    const rep = await ctx.app.inject({ method: "POST", url: `/api/unlocks/${viewer.unlock_id}/report`, headers: { cookie: buyer }, payload: { reason: "rahatsiz_etti", note: "Gece aradı" } });
    expect(rep.statusCode).toBe(201);
    expect((await detail(id, buyer)).contact.viewers[0].reported).toBe(true);
    expect((await detail(id, seller)).contact).toMatchObject({ phone: null, blocked: true });
    expect((await unlock(seller, id)).statusCode).toBe(403);
    const o = await ctx.app.inject({ method: "POST", url: `/api/requests/${id}/offers`, headers: { cookie: seller }, payload: { price: 18000 } });
    expect(o.json().error).toBe("numara_acilmadi");
    const other = await login(ctx, "05321112255");
    expect((await ctx.app.inject({ method: "POST", url: `/api/unlocks/${viewer.unlock_id}/report`, headers: { cookie: other }, payload: { reason: "rahatsiz_etti" } })).statusCode).toBe(404);
  });

  it("satıcı 'ulaşılamıyor' bildirir; yönetici iade eder, kredi geri yüklenir ve satıcıya haber gider", async () => {
    await setting("free_unlocks_per_month", 0);
    const buyer = await login(ctx, "05321112233");
    const seller = await login(ctx, "05321112244");
    const admin = await login(ctx, "yonetici@almakisterim.com");
    await ctx.pool.query("UPDATE users SET credits = 10 WHERE phone = '905321112244'");
    const id = await createRequest(ctx, buyer);
    await unlock(seller, id);
    const mine = (await ctx.app.inject({ url: "/api/me/unlocks", headers: { cookie: seller } })).json().items[0];
    expect(mine).toMatchObject({ request_id: id, credits: 3, phone: "905321112233", report_status: null });

    const rep = await ctx.app.inject({ method: "POST", url: `/api/unlocks/${mine.id}/report`, headers: { cookie: seller }, payload: { reason: "ulasilamiyor" } });
    expect(rep.statusCode).toBe(201);
    expect((await ctx.app.inject({ method: "POST", url: `/api/unlocks/${mine.id}/report`, headers: { cookie: seller }, payload: { reason: "sahte_talep" } })).statusCode).toBe(409);

    expect((await ctx.app.inject({ url: "/api/admin/contact-reports", headers: { cookie: seller } })).statusCode).toBe(403);
    const list = (await ctx.app.inject({ url: "/api/admin/contact-reports", headers: { cookie: admin } })).json().items;
    expect(list[0]).toMatchObject({ reason_text: "Numaraya ulaşılamıyor", credits: 3, seller_phone: "0532 111 22 44" });
    const res = await ctx.app.inject({ method: "POST", url: `/api/admin/contact-reports/${list[0].id}/resolve`, headers: { cookie: admin }, payload: { action: "refund" } });
    expect(res.json()).toMatchObject({ status: "refunded", refunded_credits: 3 });
    expect((await ctx.pool.query("SELECT credits FROM users WHERE phone = '905321112244'")).rows[0].credits).toBe(10);
    expect((await ctx.pool.query("SELECT delta, reason FROM credit_ledger ORDER BY id")).rows).toEqual([{ delta: -3, reason: "numara" }, { delta: 3, reason: "numara_iade" }]);
    expect((await ctx.app.inject({ method: "POST", url: `/api/admin/contact-reports/${list[0].id}/resolve`, headers: { cookie: admin }, payload: { action: "refund" } })).statusCode).toBe(409);
    expect((await ctx.app.inject({ url: "/api/me/notifications", headers: { cookie: seller } })).json().items[0].text).toContain("3 kredi iade edildi");
    expect((await ctx.app.inject({ url: "/api/me/unlocks", headers: { cookie: seller } })).json().items[0]).toMatchObject({ refunded: true, report_status: "refunded" });

    const stats = (await ctx.app.inject({ url: "/api/admin/unlocks", headers: { cookie: admin } })).json();
    expect(stats.summary).toMatchObject({ month: 1, month_credits: 3, refunded_credits: 3 });
    expect(stats.by_top[0]).toMatchObject({ id: "elektronik", unlocks: 1, credits: 3 });
  });

  it("satıcı bildirimi 7 günden sonra yapılamaz", async () => {
    const buyer = await login(ctx, "05321112233");
    const seller = await login(ctx, "05321112244");
    const id = await createRequest(ctx, buyer);
    await unlock(seller, id);
    await ctx.pool.query("UPDATE contact_unlocks SET created_at = now() - interval '8 days'");
    const u = (await ctx.app.inject({ url: "/api/me/unlocks", headers: { cookie: seller } })).json().items[0];
    expect((await ctx.app.inject({ method: "POST", url: `/api/unlocks/${u.id}/report`, headers: { cookie: seller }, payload: { reason: "sahte_talep" } })).json().error).toBe("sure_doldu");
  });
});

describe("başlangıç dönemi", () => {
  it("lansman modunda numara ücretsizdir ve aylık ücretsiz hakkı harcamaz", async () => {
    await setting("launch_mode", true);
    await setting("free_unlocks_per_month", 1);
    const buyer = await login(ctx, "05321112233");
    const seller = await login(ctx, "05321112244");
    const a = await createRequest(ctx, buyer), b = await createRequest(ctx, buyer);
    expect((await detail(a)).contact.price).toBe(0);
    expect((await unlock(seller, a)).json()).toMatchObject({ charged_credits: 0, free: false });
    expect((await unlock(seller, b)).statusCode).toBe(201);
    const me = (await ctx.app.inject({ url: "/api/me", headers: { cookie: seller } })).json().user;
    expect(me).toMatchObject({ free_unlocks_left: 1, launch_mode: true, unlock_price: 0 });
    await setting("launch_mode", false);
    expect((await detail(a)).contact.price).toBe(3);
  });

  it("kategori listesi gezinme ayarlarını ve açık talep sayılarını verir", async () => {
    const buyer = await login(ctx, "05321112233");
    await createRequest(ctx, buyer);
    const r = (await ctx.app.inject({ url: "/api/categories" })).json();
    expect(r.browse).toEqual({ min_requests: 1, show_counts_min: 20 });
    expect(r.launch_mode).toBe(false);
    const el = r.categories.find((c: { id: string }) => c.id === "elektronik");
    expect(el.active_count).toBe(1);
    expect(el.subs.find((c: { id: string }) => c.id === "telefon").active_count).toBe(1);
    expect(r.categories.find((c: { id: string }) => c.id === "emlak").active_count).toBe(0);
  });
});
