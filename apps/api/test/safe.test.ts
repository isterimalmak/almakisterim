import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { normalizeIban, safeFees } from "../src/modules/safe.js";
import { iyzicoAuth, IyzicoPayments } from "../src/services/payments.js";
import { createRequest, login, makeApp, resetData, type TestCtx } from "./helpers.js";

let ctx: TestCtx;
beforeEach(async () => {
  ctx ??= await makeApp();
  await resetData(ctx.pool);
});
afterAll(async () => { await ctx.app.close(); await ctx.pool.end(); });

const IBAN = "TR33 0006 1005 1978 6457 8413 26";
const req = (cookie: string, method: "GET" | "POST" | "PUT", url: string, payload?: Record<string, unknown>) =>
  ctx.app.inject({ method, url: `/api${url}`, headers: { cookie }, payload });
const address = { ship_name: "Elif Sönmez", ship_phone: "05321112233", ship_city: "İstanbul", ship_address: "Caferağa Mah. Moda Cad. No: 5 D: 3 Kadıköy" };

// Alıcı talep verir, satıcı iletişimi açar.
async function setup() {
  const buyer = await login(ctx, "05321112233", "Elif Sönmez");
  const id = await createRequest(ctx, buyer);
  const seller = await login(ctx, "05321112244", "Can Yıldız");
  await req(seller, "POST", `/requests/${id}/unlock`);
  return { buyer, seller, id };
}
async function startSale(seller: string, id: number, over: Record<string, unknown> = {}) {
  return req(seller, "POST", "/safe/sales", { request_id: id, title: "iPhone 13 128 GB", description: "Kutulu, faturalı", price: 18000, iban: IBAN, iban_name: "Can Yıldız", ...over });
}
async function paidSale() {
  const s = await setup();
  const sale = (await startSale(s.seller, s.id)).json();
  const url = (await req(s.buyer, "POST", `/safe/sales/${sale.id}/pay`, address)).json().url as string;
  const token = new URL(url).searchParams.get("deneme_odeme")!;
  expect((await req(s.buyer, "POST", `/safe/sales/${sale.id}/test-pay`, { token })).json().status).toBe("odendi");
  return { ...s, sale };
}

describe("Güvenli Al hesaplamaları", () => {
  it("komisyon: satıcı yüzdesi en az/en fazla sınırıyla, alıcı hizmet bedeli yüzde", () => {
    const s = { sellerPct: 5, buyerPct: 1.5, minFee: 25, maxFee: 2500 };
    expect(safeFees(1_800_000, s)).toEqual({ seller_fee: 90_000, buyer_fee: 27_000, total: 1_827_000, payout: 1_710_000 });
    expect(safeFees(20_000, s).seller_fee).toBe(2_500); // 200 TL'de %5 = 10 TL, en az 25 TL
    expect(safeFees(10_000_000, s).seller_fee).toBe(250_000); // 100.000 TL'de en fazla 2.500 TL
    expect(safeFees(1_000, { ...s, minFee: 25 }).seller_fee).toBe(1_000); // komisyon ürün bedelini geçemez
  });

  it("IBAN doğrulama", () => {
    expect(normalizeIban(IBAN)).toBe("TR330006100519786457841326");
    expect(normalizeIban("TR330006100519786457841327")).toBeNull();
    expect(normalizeIban("DE89370400440532013000")).toBeNull();
  });

  it("iyzico imzası ve istek gövdesi", async () => {
    const auth = iyzicoAuth("anahtar", "gizli", "/payment/test", "{}", "123");
    expect(auth.startsWith("IYZWSv2 ")).toBe(true);
    expect(Buffer.from(auth.slice(8), "base64").toString()).toMatch(/^apiKey:anahtar&randomKey:123&signature:[0-9a-f]{64}$/);

    const calls: { url: string; body: Record<string, unknown>; auth: string }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)), auth: String((init.headers as Record<string, string>).Authorization) });
      if (url.endsWith("/initialize/auth/ecom")) return new Response(JSON.stringify({ status: "success", token: "tok1", paymentPageUrl: "https://sandbox.iyzipay.com/odeme" }));
      return new Response(JSON.stringify({ status: "success", paymentStatus: "SUCCESS", basketId: "GA-7", paymentId: "p1", paidPrice: 1015, fraudStatus: 1,
        itemTransactions: [{ itemId: "urun-7", paymentTransactionId: "t1", paidPrice: 1000 }, { itemId: "hizmet-7", paymentTransactionId: "t2", paidPrice: 15 }] }));
    }) as unknown as typeof fetch;
    const p = new IyzicoPayments("anahtar", "gizli", "https://sandbox-api.iyzipay.com/", fake);
    const st = await p.start({ saleId: 7, total: 101_500, ip: "1.2.3.4", callbackUrl: "https://almakisterim.com/api/safe/callback?sale=7",
      items: [{ id: "urun-7", name: "iPhone", price: 100_000 }, { id: "hizmet-7", name: "Hizmet", price: 1_500, virtual: true }],
      buyer: { id: "u1", name: "Elif Sönmez", email: null, phone: "905321112233", city: "İstanbul", address: "Moda" } });
    expect(st).toEqual({ token: "tok1", url: "https://sandbox.iyzipay.com/odeme" });
    expect(calls[0]!.url).toBe("https://sandbox-api.iyzipay.com/payment/iyzipos/checkoutform/initialize/auth/ecom");
    expect(calls[0]!.body).toMatchObject({ price: "1015.00", paidPrice: "1015.00", basketId: "GA-7", buyer: { name: "Elif", surname: "Sönmez", gsmNumber: "+905321112233" } });
    expect((calls[0]!.body.basketItems as { itemType: string; price: string }[]).map((i) => [i.itemType, i.price])).toEqual([["PHYSICAL", "1000.00"], ["VIRTUAL", "15.00"]]);
    const v = await p.verify("tok1", 7);
    expect(v).toMatchObject({ ok: true, ref: "p1", paid: 101_500, items: [{ id: "urun-7", tx: "t1", price: 100_000 }, { id: "hizmet-7", tx: "t2", price: 1_500 }] });
    expect((await p.verify("tok1", 8)).ok).toBe(false); // başka satışın sepeti
  });
});

describe("Güvenli Al akışı", () => {
  it("satış → ödeme → kargo → alıcı onayı → yönetici satıcıya öder", async () => {
    const { buyer, seller, sale } = await paidSale();
    expect(sale).toMatchObject({ status: "odeme_bekliyor", price: 1_800_000, seller_fee: 90_000, buyer_fee: 27_000, total: 1_827_000, payout: 1_710_000, role: "satici", mode: "test" });

    // Alıcı komisyonu görmez; satıcı ödeme sonrası teslimat adresini görür.
    const b = (await req(buyer, "GET", `/safe/sales/${sale.id}`)).json();
    expect(b.role).toBe("alici");
    expect(b.seller_fee).toBeUndefined();
    const s = (await req(seller, "GET", `/safe/sales/${sale.id}`)).json();
    expect(s.ship).toMatchObject({ name: "Elif Sönmez", city: "İstanbul" });
    expect(s.ship_deadline).toBeTruthy();

    expect((await req(buyer, "POST", `/safe/sales/${sale.id}/ship`, { cargo_company: "Yurtiçi", tracking_no: "123456789" })).statusCode).toBe(403);
    expect((await req(buyer, "POST", `/safe/sales/${sale.id}/confirm`)).json().error).toBe("durum_uygun_degil");
    const shipped = (await req(seller, "POST", `/safe/sales/${sale.id}/ship`, { cargo_company: "Yurtiçi Kargo", tracking_no: "123456789" })).json();
    expect(shipped).toMatchObject({ status: "kargoda", cargo_company: "Yurtiçi Kargo", tracking_no: "123456789" });
    expect(shipped.release_at).toBeTruthy();

    expect((await req(seller, "POST", `/safe/sales/${sale.id}/confirm`)).statusCode).toBe(403);
    expect((await req(buyer, "POST", `/safe/sales/${sale.id}/confirm`)).json().status).toBe("tamamlandi");

    const notes = (await ctx.pool.query("SELECT text FROM notifications ORDER BY id")).rows.map((r) => r.text as string);
    expect(notes.some((t) => t.includes("ödeme yapıldı"))).toBe(true);
    expect(notes.some((t) => t.includes("kargoya verildi"))).toBe(true);
    expect(notes.some((t) => t.includes("17.100 TL hesabınıza gönderilecek"))).toBe(true);

    const admin = await login(ctx, "yonetici@almakisterim.com", "Yönetici");
    const list = (await req(admin, "GET", "/admin/safe?status=odenecek")).json();
    expect(list.totals).toMatchObject({ to_pay: 1_710_000, earned: 117_000, held: 0 });
    expect(list.items[0]).toMatchObject({ id: sale.id, iban: "TR33 0006 1005 1978 6457 8413 26", iban_name: "Can Yıldız" });
    expect((await req(admin, "POST", `/admin/safe/${sale.id}/payout`, { note: "Havale 20.10" })).statusCode).toBe(200);
    expect((await req(admin, "POST", `/admin/safe/${sale.id}/payout`, { note: "" })).json().error).toBe("zaten_odendi");
    expect((await req(admin, "GET", "/admin/safe")).json().totals.to_pay).toBe(0);
    expect((await req(seller, "GET", "/safe/sales")).json().items[0]).toMatchObject({ id: sale.id, role: "satici", status: "tamamlandi", other_name: "Elif S." });
  });

  it("satış başlatma kuralları: iletişim, kategori, IBAN, tek açık satış, deneme ödemesi yalnızca alıcıya", async () => {
    const buyer = await login(ctx, "05321112233");
    const id = await createRequest(ctx, buyer);
    const seller = await login(ctx, "05321112244");
    expect((await startSale(seller, id)).json().error).toBe("iletisim_acilmadi");
    await req(seller, "POST", `/requests/${id}/unlock`);
    expect((await startSale(buyer, id)).json().error).toBe("kendi_talebi");
    expect((await startSale(seller, id, { iban: "TR00 1234" })).json().error).toBe("iban_gecersiz");
    expect((await startSale(seller, id, { iban: undefined, iban_name: undefined })).json().error).toBe("iban_gerekli");
    expect((await startSale(seller, id, { price: 300000 })).json().error).toBe("fiyat_yuksek");
    const sale = (await startSale(seller, id)).json();
    expect((await startSale(seller, id)).json().error).toBe("acik_satis");

    // Satıcının IBAN'ı kayıtlı kaldı; alıcının ödeme sayfası satıcıya kapalı.
    expect((await req(seller, "GET", "/safe/info")).json()).toMatchObject({ enabled: true, mode: "test", iban: "TR330006100519786457841326" });
    expect((await req(seller, "POST", `/safe/sales/${sale.id}/pay`, address)).statusCode).toBe(403);
    expect((await req(buyer, "POST", `/safe/sales/${sale.id}/test-pay`, { token: "uydurma" })).json().error).toBe("odeme_hatasi");
    const other = await login(ctx, "05321112255");
    expect((await req(other, "GET", `/safe/sales/${sale.id}`)).statusCode).toBe(404);

    // Emlak/vasıta gibi kargolanamayan kategoriler kapalı.
    await ctx.pool.query("UPDATE settings SET value = '[\"ev\"]' WHERE key = 'safe_tops'");
    const id2 = await createRequest(ctx, buyer, { title: "Başka bir iPhone almak istiyorum" });
    await req(seller, "POST", `/requests/${id2}/unlock`);
    expect((await startSale(seller, id2)).json().error).toBe("kategori_kapali");

    // Ödenmeden iptal.
    expect((await req(buyer, "POST", `/safe/sales/${sale.id}/cancel`)).json().status).toBe("iptal");
    expect((await req(buyer, "POST", `/safe/sales/${sale.id}/pay`, address)).json().error).toBe("durum_uygun_degil");
  });

  it("sorun bildirimi: otomatik onay durur, yönetici iade eder", async () => {
    const { buyer, seller, sale } = await paidSale();
    await req(seller, "POST", `/safe/sales/${sale.id}/ship`, { cargo_company: "Aras", tracking_no: "998877" });
    expect((await req(buyer, "POST", `/safe/sales/${sale.id}/dispute`, { reason: "kısa" })).statusCode).toBe(400);
    const d = (await req(buyer, "POST", `/safe/sales/${sale.id}/dispute`, { reason: "Ürün kutudan kırık çıktı, fotoğrafları var." })).json();
    expect(d).toMatchObject({ status: "sorunlu", release_at: null });

    const admin = await login(ctx, "yonetici@almakisterim.com", "Yönetici");
    const list = (await req(admin, "GET", "/admin/safe")).json();
    expect(list.totals).toMatchObject({ disputes: 1, held: 1_827_000 });
    expect(list.items[0].dispute_reason).toContain("kırık");
    expect((await req(admin, "POST", `/admin/safe/${sale.id}/resolve`, { action: "refund", note: "Kırık ürün" })).statusCode).toBe(200);
    const after = (await req(buyer, "GET", `/safe/sales/${sale.id}`)).json();
    expect(after.status).toBe("iade");
    expect(after.events.map((e: { kind: string }) => e.kind)).toEqual(["olusturuldu", "odendi", "kargolandi", "sorun", "iade"]);
    expect((await req(buyer, "POST", `/safe/sales/${sale.id}/confirm`)).json().error).toBe("durum_uygun_degil");
  });

  it("saatlik iş: onay süresi dolan kargo tamamlanır, kargolanmayan satış iade edilir", async () => {
    const a = await paidSale();
    await req(a.seller, "POST", `/safe/sales/${a.sale.id}/ship`, { cargo_company: "MNG", tracking_no: "556677" });
    await ctx.pool.query("UPDATE safe_sales SET release_at = now() - interval '1 minute' WHERE id = $1", [a.sale.id]);

    const id2 = await createRequest(ctx, a.buyer, { title: "İkinci iPhone talebim burada" });
    await req(a.seller, "POST", `/requests/${id2}/unlock`);
    const s2 = (await startSale(a.seller, id2)).json();
    const url = (await req(a.buyer, "POST", `/safe/sales/${s2.id}/pay`, address)).json().url as string;
    await req(a.buyer, "POST", `/safe/sales/${s2.id}/test-pay`, { token: new URL(url).searchParams.get("deneme_odeme") });
    await ctx.pool.query("UPDATE safe_sales SET paid_at = now() - interval '6 days' WHERE id = $1", [s2.id]);

    const r = await ctx.app.inject({ method: "POST", url: "/api/jobs/expire", headers: { "x-job-token": "test-job-token-123" } });
    expect(r.json().safe).toEqual({ completed: 1, refunded: 1, cancelled: 0 });
    const st = (await ctx.pool.query("SELECT id, status FROM safe_sales ORDER BY id")).rows.map((x) => x.status);
    expect(st).toEqual(["tamamlandi", "iade"]);
  });

  it("ödeme dönüşü (form gönderimi) doğrular ve yönlendirir; yönetici ayarları değiştirir", async () => {
    const { buyer, seller, id } = await setup();
    const sale = (await startSale(seller, id)).json();
    const url = (await req(buyer, "POST", `/safe/sales/${sale.id}/pay`, address)).json().url as string;
    const token = new URL(url).searchParams.get("deneme_odeme")!;
    const bad = await ctx.app.inject({ method: "POST", url: `/api/safe/callback?sale=${sale.id}`, headers: { "content-type": "application/x-www-form-urlencoded" }, payload: "token=yanlis" });
    expect(bad.statusCode).toBe(303);
    expect(bad.headers.location).toBe(`http://localhost:3000/guvenli-al/${sale.id}?odeme=hata`);
    const ok = await ctx.app.inject({ method: "POST", url: `/api/safe/callback?sale=${sale.id}`, headers: { "content-type": "application/x-www-form-urlencoded" }, payload: `token=${token}` });
    expect(ok.headers.location).toBe(`http://localhost:3000/guvenli-al/${sale.id}?odeme=tamam`);
    expect((await req(buyer, "GET", `/safe/sales/${sale.id}`)).json().status).toBe("odendi");

    const admin = await login(ctx, "yonetici@almakisterim.com", "Yönetici");
    expect((await req(seller, "PUT", "/admin/safe/settings", { safe_seller_pct: 3 })).statusCode).toBe(403);
    expect((await req(admin, "PUT", "/admin/safe/settings", { safe_seller_pct: 3, safe_buyer_pct: 0, safe_enabled: false })).statusCode).toBe(200);
    expect((await req(buyer, "GET", "/safe/info")).json()).toMatchObject({ enabled: false, seller_pct: 3, buyer_pct: 0 });
    expect((await startSale(seller, id)).json().error).toBe("kapali");
  });
});
