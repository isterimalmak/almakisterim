import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import type { Config } from "../config.js";
import type { Pool } from "../db.js";

// Yönetim → Entegrasyonlar: hizmet anahtarları panelden girilebilir. Panelden girilen değer, sunucu ayarındakinin (Secret Manager) önüne geçer.
// Gizli alanlar bir kez yazılır, bir daha hiçbir yanıtta dönmez; yalnızca "kayıtlı" bilgisi ve tarih görünür.

export type Field = { key: keyof Config & string; label: string; secret: boolean; placeholder?: string };
export type Group = { id: string; name: string; note: string; help: string; fields: Field[] };

export const GROUPS: Group[] = [
  { id: "ai", name: "Yapay zekâ (Anthropic Claude)", note: "Talebi otomatik doldurma, içerik denetimi, blog",
    help: "console.anthropic.com → API Keys → Create Key. Anahtar sk-ant- ile başlar.",
    fields: [{ key: "ANTHROPIC_API_KEY", label: "API anahtarı", secret: true, placeholder: "sk-ant-..." },
      { key: "CLAUDE_MODEL", label: "Model (boş bırakılırsa claude-opus-5-5)", secret: false, placeholder: "claude-opus-5-5" }] },
  { id: "mail", name: "E-posta (Resend)", note: "E-postayla giriş kodu ve bildirim e-postaları",
    help: "resend.com → API Keys → Create API Key. Gönderen adresin alan adı Resend'de doğrulanmış olmalı.",
    fields: [{ key: "RESEND_API_KEY", label: "API anahtarı", secret: true, placeholder: "re_..." },
      { key: "MAIL_FROM", label: "Gönderen", secret: false, placeholder: "almakisterim <bildirim@almakisterim.com>" }] },
  { id: "smtp", name: "E-posta (kendi sunucunuz / SMTP)", note: "@almakisterim.com adresinizden gönderim; girilirse Resend yerine bu kullanılır",
    help: "Hosting paneli (cPanel/Plesk) → E-posta Hesapları → bildirim@almakisterim.com açın; \"Mail istemcisi ayarları\"ndaki giden sunucu (SMTP) bilgilerini girin. Gmail: smtp.gmail.com, 465, uygulama şifresi. Yandex: smtp.yandex.com.tr, 465. Gönderen adresi yukarıdaki Resend kartındaki \"Gönderen\" alanından alınır; alan adı tutmuyorsa SMTP kullanıcı adresi kullanılır.",
    fields: [{ key: "SMTP_HOST", label: "SMTP sunucusu", secret: false, placeholder: "mail.almakisterim.com" },
      { key: "SMTP_PORT", label: "Port (465 SSL ya da 587)", secret: false, placeholder: "465" },
      { key: "SMTP_USER", label: "Kullanıcı adı (e-posta adresi)", secret: false, placeholder: "bildirim@almakisterim.com" },
      { key: "SMTP_PASS", label: "Şifre", secret: true }] },
  { id: "sms", name: "SMS (Netgsm)", note: "SMS ile giriş kodu ve talep alarmları",
    help: "Netgsm paneli → Abonelik bilgileri: kullanıcı kodu (850... ile başlayan numara), API şifresi ve onaylı mesaj başlığı.",
    fields: [{ key: "NETGSM_USERCODE", label: "Kullanıcı kodu", secret: true }, { key: "NETGSM_PASSWORD", label: "Şifre", secret: true },
      { key: "NETGSM_HEADER", label: "Mesaj başlığı", secret: false, placeholder: "ALMAKISTER" }] },
  { id: "review", name: "Mağaza inceleme hesabı", note: "Google Play / App Store inceleme ekibinin SMS beklemeden giriş yapması için",
    help: "Play Console → Uygulama içeriği → Oturum açma bilgileri'ne yazdığınız telefon numarası ve 6 haneli şifrenin aynısını girin. Bu numaraya SMS gönderilmez; kod sabittir. İnceleme bitince silebilirsiniz.",
    fields: [{ key: "REVIEW_PHONE", label: "Telefon numarası", secret: false, placeholder: "05XXXXXXXXX" }, { key: "REVIEW_CODE", label: "6 haneli kod", secret: true }] },
  { id: "photos", name: "Ücretsiz fotoğraflar (Pixabay / Pexels)", note: "Talebe uyan hazır görseller",
    help: "pixabay.com/api/docs (giriş yapınca anahtar sayfada görünür) ya da pexels.com/api.",
    fields: [{ key: "PIXABAY_API_KEY", label: "Pixabay anahtarı", secret: true }, { key: "PEXELS_API_KEY", label: "Pexels anahtarı", secret: true }] },
  { id: "pay", name: "Güvenli Al ödemeleri (iyzico)", note: "Kartla ödeme; para ürün teslim alınana kadar bekletilir",
    help: "merchant.iyzipay.com → Ayarlar → Firma Ayarları: API anahtarı ve güvenlik anahtarı. Denemek için sandbox-merchant.iyzipay.com anahtarlarıyla adresi https://sandbox-api.iyzipay.com bırakın; gerçek ödemede adres https://api.iyzipay.com olmalı.",
    fields: [{ key: "IYZICO_API_KEY", label: "API anahtarı", secret: true }, { key: "IYZICO_SECRET_KEY", label: "Güvenlik anahtarı", secret: true },
      { key: "IYZICO_BASE_URL", label: "Adres", secret: false, placeholder: "https://api.iyzipay.com" }] },
  { id: "google", name: "Google ile giriş", note: "Tek tıkla giriş",
    help: "console.cloud.google.com → API'ler ve Hizmetler → Kimlik bilgileri → OAuth istemci kimliği (Web uygulaması).",
    fields: [{ key: "GOOGLE_CLIENT_ID", label: "İstemci kimliği", secret: false, placeholder: "....apps.googleusercontent.com" },
      { key: "GOOGLE_CLIENT_SECRET", label: "İstemci gizli anahtarı", secret: true }] },
  { id: "storage", name: "Fotoğraf ve video deposu (Cloudflare R2)", note: "Fotoğraf/video yükleme",
    help: "dash.cloudflare.com → R2 → API belirteçlerini yönet → Hesap kimliği, erişim anahtarı ve gizli anahtar.",
    fields: [{ key: "R2_ACCOUNT_ID", label: "Hesap kimliği", secret: false }, { key: "R2_ACCESS_KEY_ID", label: "Erişim anahtarı", secret: true },
      { key: "R2_SECRET_ACCESS_KEY", label: "Gizli erişim anahtarı", secret: true }, { key: "R2_BUCKET", label: "Depo adı", secret: false, placeholder: "almakisterim-media" },
      { key: "R2_PUBLIC_URL", label: "Genel adres", secret: false, placeholder: "https://medya.almakisterim.com" }] },
];
export const FIELDS = GROUPS.flatMap((g) => g.fields);

function cipherKey(pepper: string) {
  return Buffer.from(hkdfSync("sha256", pepper, "almakisterim", "entegrasyon-anahtarlari", 32));
}
export function encrypt(pepper: string, plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", cipherKey(pepper), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1:${iv.toString("base64")}:${c.getAuthTag().toString("base64")}:${body.toString("base64")}`;
}
export function decrypt(pepper: string, enc: string): string | null {
  try {
    const [v, iv, tag, body] = enc.split(":");
    if (v !== "v1" || !iv || !tag || !body) return null;
    const d = createDecipheriv("aes-256-gcm", cipherKey(pepper), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(body, "base64")), d.final()]).toString("utf8");
  } catch { return null; }
}

// Panelden girilen değerleri yapılandırmaya uygular; değişince hizmetler yeniden kurulur (yeniden yayına gerek yok).
// Birden fazla sunucu çalışıyorsa her biri dakikada bir değişikliğe bakar.
export class Integrations {
  private base: Record<string, string>;
  private stamp = "";
  private panel = new Map<string, { at: string }>();
  private timer?: NodeJS.Timeout;
  constructor(private pool: Pool, private config: Config, private onChange: () => void = () => {}) {
    this.base = Object.fromEntries(FIELDS.map((f) => [f.key, String(config[f.key] ?? "")]));
  }
  start(everyMs = 60_000) { this.timer = setInterval(() => void this.refresh().catch(() => {}), everyMs); this.timer.unref(); }
  stop() { if (this.timer) clearInterval(this.timer); }

  async refresh(force = false) {
    const { rows } = await this.pool.query<{ name: string; value_enc: string; updated_at: Date }>("SELECT name, value_enc, updated_at FROM integration_settings");
    const stamp = rows.map((r) => `${r.name}@${r.updated_at.toISOString()}`).sort().join("|");
    if (!force && stamp === this.stamp) return false;
    this.stamp = stamp;
    this.panel.clear();
    const next: Record<string, string> = { ...this.base };
    for (const r of rows) {
      const v = decrypt(this.config.CODE_PEPPER, r.value_enc);
      if (v === null || !FIELDS.some((f) => f.key === r.name)) continue;
      next[r.name] = v;
      this.panel.set(r.name, { at: r.updated_at.toISOString() });
    }
    Object.assign(this.config, next);
    this.onChange();
    return true;
  }

  async save(key: string, value: string | null, userId: string) {
    if (value === null) await this.pool.query("DELETE FROM integration_settings WHERE name = $1", [key]);
    else await this.pool.query(
      `INSERT INTO integration_settings (name, value_enc, updated_by, updated_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (name) DO UPDATE SET value_enc = EXCLUDED.value_enc, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [key, encrypt(this.config.CODE_PEPPER, value), userId]);
    await this.refresh(true);
  }

  // Panelde gösterilecek durum: gizli alanlarda değer asla dönmez.
  status() {
    return GROUPS.map((g) => ({
      id: g.id, name: g.name, note: g.note, help: g.help,
      fields: g.fields.map((f) => {
        const cur = String(this.config[f.key] ?? "").trim();
        const panel = this.panel.get(f.key);
        return { key: f.key, label: f.label, secret: f.secret, placeholder: f.placeholder ?? "", set: !!cur,
          source: panel ? "panel" : this.base[f.key]?.trim() ? "sunucu" : "yok", updated_at: panel?.at ?? null,
          value: f.secret ? undefined : cur };
      }),
    }));
  }
}

// Hizmet, panelden anahtar değişince yerinde yenilenir: rotalar hep güncel nesneye ulaşır.
const LIVE = Symbol("canli");
export function live<T extends object>(get: () => T): T {
  return new Proxy({} as T, {
    get(_t, prop) {
      if (prop === LIVE) return true;
      const target = get(); const v = Reflect.get(target, prop, target); return typeof v === "function" ? v.bind(target) : v;
    },
    has(_t, prop) { return prop === LIVE || prop in get(); },
    // "instanceof" o anki hizmete bakar (ör. geliştirmede bellek kutusu).
    getPrototypeOf() { return Object.getPrototypeOf(get()); },
  });
}
export const isLive = (o: object) => LIVE in o;
