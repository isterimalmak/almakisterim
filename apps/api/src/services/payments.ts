import { createHmac, randomBytes } from "node:crypto";
import type { Config } from "../config.js";

// Güvenli Al ödeme sağlayıcısı. Alıcı sağlayıcının ödeme sayfasında kartla öder; sağlayıcı sonucu geri bildirir,
// sunucu sonucu sağlayıcıdan ayrıca sorgulayarak doğrular. Kart bilgisi sitemize hiç gelmez.

export type PayItem = { id: string; name: string; price: number; virtual?: boolean }; // price: kuruş
export type PayStart = {
  saleId: number; total: number; items: PayItem[]; callbackUrl: string; ip: string;
  buyer: { id: string; name: string; email: string | null; phone: string | null; city: string; address: string };
};
export type PayResult = { ok: boolean; ref: string; paid: number; items: { id: string; tx: string; price: number }[]; message: string };

export interface PaymentProvider {
  readonly name: "test" | "iyzico" | "kapali";
  readonly enabled: boolean;
  start(o: PayStart): Promise<{ token: string; url: string }>;
  verify(token: string, saleId: number): Promise<PayResult>;
  refund(saleId: number, items: { tx: string; price: number }[], ip: string): Promise<void>;
}

const tl = (kurus: number) => (kurus / 100).toFixed(2);

// Anahtar girilmemişken: geliştirme ve testlerde sitenin kendi deneme ödeme ekranı, canlıda Güvenli Al kapalı.
export class TestPayments implements PaymentProvider {
  readonly name = "test" as const;
  readonly enabled = true;
  private pending = new Map<string, { saleId: number; total: number; items: PayItem[] }>();
  constructor(private appUrl: string) {}
  async start(o: PayStart) {
    const token = `deneme-${randomBytes(12).toString("hex")}`;
    this.pending.set(token, { saleId: o.saleId, total: o.total, items: o.items });
    return { token, url: `${this.appUrl}/guvenli-al/${o.saleId}?deneme_odeme=${token}` };
  }
  async verify(token: string, saleId: number): Promise<PayResult> {
    const p = this.pending.get(token);
    if (!p || p.saleId !== saleId) return { ok: false, ref: "", paid: 0, items: [], message: "Deneme ödemesi bulunamadı." };
    this.pending.delete(token);
    return { ok: true, ref: token, paid: p.total, items: p.items.map((i) => ({ id: i.id, tx: `${token}-${i.id}`, price: i.price })), message: "" };
  }
  async refund() {}
}

export const disabledPayments: PaymentProvider = {
  name: "kapali", enabled: false,
  async start() { throw new Error("Ödeme altyapısı bağlı değil."); },
  async verify() { return { ok: false, ref: "", paid: 0, items: [], message: "Ödeme altyapısı bağlı değil." }; },
  async refund() { throw new Error("Ödeme altyapısı bağlı değil."); },
};

// iyzico imzası (IYZWSv2): HMAC-SHA256(gizli anahtar, rastgele + yol + gövde).
export function iyzicoAuth(apiKey: string, secret: string, path: string, body: string, rnd: string) {
  const signature = createHmac("sha256", secret).update(rnd + path + body).digest("hex");
  return "IYZWSv2 " + Buffer.from(`apiKey:${apiKey}&randomKey:${rnd}&signature:${signature}`).toString("base64");
}

type IyziRes = { status?: string; errorMessage?: string; errorCode?: string } & Record<string, unknown>;

export class IyzicoPayments implements PaymentProvider {
  readonly name = "iyzico" as const;
  readonly enabled = true;
  constructor(private apiKey: string, private secret: string, private base: string, private fetcher: typeof fetch = fetch) {}

  async call(path: string, payload: Record<string, unknown>): Promise<IyziRes> {
    const body = JSON.stringify(payload);
    const rnd = `${Date.now()}${randomBytes(4).toString("hex")}`;
    const res = await this.fetcher(this.base.replace(/\/+$/, "") + path, {
      method: "POST", body,
      headers: { "Content-Type": "application/json", Accept: "application/json", "x-iyzi-rnd": rnd, Authorization: iyzicoAuth(this.apiKey, this.secret, path, body, rnd) },
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json().catch(() => ({}))) as IyziRes;
    if (data.status !== "success") throw new Error(data.errorMessage ? `iyzico: ${data.errorMessage}` : `iyzico yanıt vermedi (${res.status}).`);
    return data;
  }

  async start(o: PayStart) {
    const [name, ...rest] = (o.buyer.name.trim() || "Alıcı").split(/\s+/);
    const addr = { contactName: o.buyer.name || "Alıcı", city: o.buyer.city, country: "Turkey", address: o.buyer.address };
    const r = await this.call("/payment/iyzipos/checkoutform/initialize/auth/ecom", {
      locale: "tr", conversationId: String(o.saleId), price: tl(o.total), paidPrice: tl(o.total), currency: "TRY",
      basketId: `GA-${o.saleId}`, paymentGroup: "PRODUCT", callbackUrl: o.callbackUrl, enabledInstallments: [1, 2, 3, 6, 9],
      buyer: {
        id: o.buyer.id, name, surname: rest.join(" ") || name, email: o.buyer.email ?? `uye-${o.buyer.id.slice(0, 8)}@almakisterim.com`,
        gsmNumber: o.buyer.phone ? `+${o.buyer.phone}` : undefined, identityNumber: "11111111111",
        registrationAddress: o.buyer.address, city: o.buyer.city, country: "Turkey", ip: o.ip,
      },
      shippingAddress: addr, billingAddress: addr,
      basketItems: o.items.map((i) => ({ id: i.id, name: i.name.slice(0, 100), category1: i.virtual ? "Hizmet" : "Güvenli Al", itemType: i.virtual ? "VIRTUAL" : "PHYSICAL", price: tl(i.price) })),
    });
    if (typeof r.token !== "string" || typeof r.paymentPageUrl !== "string") throw new Error("iyzico ödeme sayfası açılamadı.");
    return { token: r.token, url: r.paymentPageUrl };
  }

  async verify(token: string, saleId: number): Promise<PayResult> {
    try {
      const r = await this.call("/payment/iyzipos/checkoutform/auth/ecom/detail", { locale: "tr", conversationId: String(saleId), token });
      const ok = r.paymentStatus === "SUCCESS" && r.basketId === `GA-${saleId}` && (r.fraudStatus === undefined || r.fraudStatus === 1);
      const txs = ((r.itemTransactions as { itemId: string; paymentTransactionId: string; paidPrice?: number; price: number }[] | undefined) ?? [])
        .map((t) => ({ id: t.itemId, tx: String(t.paymentTransactionId), price: Math.round(Number(t.paidPrice ?? t.price) * 100) }));
      return { ok, ref: String(r.paymentId ?? ""), paid: Math.round(Number(r.paidPrice ?? 0) * 100), items: txs, message: ok ? "" : "Ödeme tamamlanmadı." };
    } catch (e) {
      return { ok: false, ref: "", paid: 0, items: [], message: (e as Error).message };
    }
  }

  async refund(saleId: number, items: { tx: string; price: number }[], ip: string) {
    for (const i of items) {
      await this.call("/payment/refund", { locale: "tr", conversationId: String(saleId), paymentTransactionId: i.tx, price: tl(i.price), currency: "TRY", ip });
    }
  }

  // Panel → Entegrasyonlar → Test et: anahtarlar doğruysa kart BIN sorgusu yanıt verir.
  async ping() {
    await this.call("/payment/bin/check", { locale: "tr", conversationId: "baglanti-denemesi", binNumber: "552879" });
  }
}

export function createPayments(config: Config): PaymentProvider {
  if (config.IYZICO_API_KEY.trim() && config.IYZICO_SECRET_KEY.trim())
    return new IyzicoPayments(config.IYZICO_API_KEY.trim(), config.IYZICO_SECRET_KEY.trim(), config.IYZICO_BASE_URL.trim() || "https://sandbox-api.iyzipay.com");
  return config.isProd ? disabledPayments : new TestPayments(config.APP_URL);
}
