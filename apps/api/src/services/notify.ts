import type { FastifyBaseLogger } from "fastify";
import nodemailer, { type Transporter } from "nodemailer";
import type { Config } from "../config.js";
import { HttpError } from "../lib/util.js";
import { brandHtml } from "./mail-html.js";

// html ve başlıklar isteğe bağlı (E-posta Stüdyosu: tasarlanmış e-posta, "abonelikten çık" başlıkları).
export type MailOpts = { html?: string; headers?: Record<string, string> };
export interface Mailer {
  send(to: string, subject: string, text: string, opts?: MailOpts): Promise<void>;
}
export interface Sms {
  send(phone: string, text: string): Promise<void>;
}

// Resend ile e-posta gönderimi. https://resend.com/docs/api-reference/emails/send-email
export class ResendMailer implements Mailer {
  constructor(private apiKey: string, private from: string) {}
  async send(to: string, subject: string, text: string, opts: MailOpts = {}) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: this.from, to: [to], subject, text, ...(opts.html ? { html: opts.html } : {}), ...(opts.headers ? { headers: opts.headers } : {}) }),
    });
    if (!res.ok) throw new Error(`Resend hata kodu ${res.status}`);
  }
}

// Kendi e-posta sunucusu (hosting maili, Gmail, Yandex, Outlook…) üzerinden SMTP ile gönderim.
// 465 → doğrudan şifreli bağlantı (SSL); 587/25 → STARTTLS.
export class SmtpMailer implements Mailer {
  private t: Transporter;
  constructor(host: string, port: number, user: string, pass: string, private from: string) {
    this.t = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass }, connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 30_000 });
  }
  async verify() { await this.t.verify(); }
  async send(to: string, subject: string, text: string, opts: MailOpts = {}) {
    await this.t.sendMail({ from: this.from, to, subject, text, ...(opts.html ? { html: opts.html } : {}), ...(opts.headers ? { headers: opts.headers } : {}) });
  }
}

/** E-posta gönderimi hangi yolla açık: kendi sunucu (SMTP) önce, sonra Resend. */
export function mailProvider(c: Pick<Config, "SMTP_HOST" | "SMTP_USER" | "SMTP_PASS" | "RESEND_API_KEY">): "smtp" | "resend" | null {
  if (c.SMTP_HOST.trim() && c.SMTP_USER.trim() && c.SMTP_PASS) return "smtp";
  if (c.RESEND_API_KEY.trim()) return "resend";
  return null;
}
// Gönderen: "Gönderen" alanındaki adres SMTP hesabıyla aynı alan adındaysa o, değilse SMTP hesabının kendisi (sunucular başka adresle göndermeyi reddeder).
const domainOf = (a: string) => (a.match(/@([^>\s]+)/)?.[1] ?? "").toLowerCase();
export const smtpFrom = (c: Config) => (domainOf(c.MAIL_FROM) && domainOf(c.MAIL_FROM) === domainOf(c.SMTP_USER) ? c.MAIL_FROM : `almakisterim <${c.SMTP_USER.trim()}>`);

// Netgsm REST v2 SMS gönderimi. Canlıya almadan önce Netgsm panelindeki API
// belgesiyle uç nokta ve alanlar tekrar kontrol edilmeli.
export class NetgsmSms implements Sms {
  constructor(private usercode: string, private password: string, private header: string) {}
  async send(phone: string, text: string) {
    const auth = Buffer.from(`${this.usercode}:${this.password}`).toString("base64");
    const res = await fetch("https://api.netgsm.com.tr/sms/rest/v2/send", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({ msgheader: this.header, encoding: "TR", messages: [{ msg: text, no: phone }] }),
    });
    const body = (await res.json().catch(() => ({}))) as { code?: string };
    if (!res.ok || (body.code && body.code !== "00")) throw new Error(`Netgsm hata kodu ${res.status}/${body.code ?? "-"}`);
  }
}

// Geliştirme ve testte gerçek gönderim yapılmaz; gönderilenler bellekte tutulur.
export class MemoryOutbox implements Mailer, Sms {
  sent: { to: string; subject?: string; text: string; html?: string; headers?: Record<string, string> }[] = [];
  constructor(private log?: FastifyBaseLogger) {}
  async send(to: string, a: string, b?: string, opts?: MailOpts) {
    const item = b === undefined ? { to, text: a } : { to, subject: a, text: b, ...(opts?.html ? { html: opts.html } : {}), ...(opts?.headers ? { headers: opts.headers } : {}) };
    this.sent.push(item);
    this.log?.info({ to }, "geliştirme: mesaj gönderilmiş sayıldı");
    if (process.env.NODE_ENV === "development") console.log(`[geliştirme] ${to}: ${item.text}`);
  }
  last(to: string) {
    return [...this.sent].reverse().find((m) => m.to === to);
  }
}

// Üretimde anahtarı henüz eklenmemiş kanal: kullanıcıya anlaşılır bir mesaj döner.
export class UnavailableSender implements Mailer, Sms {
  constructor(private what: string) {}
  async send(): Promise<void> {
    throw new HttpError(503, "kanal_kapali", `${this.what} şu anda kullanılamıyor. Lütfen başka bir giriş yöntemi deneyin.`);
  }
}

// Bütün e-postalar marka şablonuyla gider: html verilmemişse düz metinden logolu, düğmeli HTML üretilir (Marka Bahçem'deki gibi).
export function branded(m: Mailer, origin: string): Mailer {
  return { send: (to, subject, text, opts = {}) => m.send(to, subject, text, opts.html ? opts : { ...opts, html: brandHtml(subject, text, origin) }) };
}

export function createNotifiers(config: Config, log?: FastifyBaseLogger): { mailer: Mailer; sms: Sms } {
  const outbox = new MemoryOutbox(log);
  const mailFallback = config.isProd ? new UnavailableSender("E-posta ile giriş") : outbox;
  const smsFallback = config.isProd ? new UnavailableSender("SMS ile giriş") : outbox;
  return {
    mailer: mailProvider(config) === "smtp" ? branded(new SmtpMailer(config.SMTP_HOST.trim(), Number(config.SMTP_PORT) || 465, config.SMTP_USER.trim(), config.SMTP_PASS, smtpFrom(config)), config.APP_URL)
      : config.RESEND_API_KEY ? branded(new ResendMailer(config.RESEND_API_KEY, config.MAIL_FROM), config.APP_URL) : mailFallback,
    sms: config.NETGSM_USERCODE && config.NETGSM_PASSWORD && config.NETGSM_HEADER
      ? new NetgsmSms(config.NETGSM_USERCODE, config.NETGSM_PASSWORD, config.NETGSM_HEADER)
      : smsFallback,
  };
}
