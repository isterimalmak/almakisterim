import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const randomToken = () => randomBytes(32).toString("base64url");
export const sixDigitCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// Türkiye cep telefonunu 905XXXXXXXXX biçimine getirir; geçersizse null.
export function normalizePhone(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("0090")) d = d.slice(2);
  if (d.length === 10 && d.startsWith("5")) d = "90" + d;
  if (d.length === 11 && d.startsWith("05")) d = "9" + d;
  return /^905\d{9}$/.test(d) ? d : null;
}

export function normalizeEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254 ? e : null;
}

const PHONE_RE = /(\+?90|0)?\s?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g;
const MAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const URL_RE = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;

// İlan ve tekliflerde iletişim bilgisi paylaşılmasın: telefon, e-posta ve bağlantıları gizler.
export function maskContacts(s: string): { text: string; masked: boolean } {
  let masked = false;
  const text = s
    .replace(PHONE_RE, () => ((masked = true), "[numara gizlendi]"))
    .replace(MAIL_RE, () => ((masked = true), "[e-posta gizlendi]"))
    .replace(URL_RE, () => ((masked = true), "[bağlantı gizlendi]"));
  return { text, masked };
}

// Herkese açık görünen ad: "Elif Sönmez" → "Elif S."
export function publicName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Üye";
  const first = parts[0]!;
  return parts.length > 1 ? `${first} ${parts[parts.length - 1]!.charAt(0).toLocaleUpperCase("tr")}.` : first;
}

export function maskTarget(channel: "email" | "sms", target: string): string {
  if (channel === "sms") return target.slice(0, 5) + "*****" + target.slice(-2);
  const [u = "", d = ""] = target.split("@");
  return u.slice(0, 2) + "***@" + d;
}

// Adres çubuğundaki kimlik (Talep No, teklif no) geçersizse "bulunamadı" döner.
export function idParam(params: unknown): number {
  const raw = (params as { id?: string }).id ?? "";
  if (!/^\d{1,12}$/.test(raw)) throw new HttpError(404, "bulunamadi", "Aradığınız kayıt bulunamadı.");
  return Number(raw);
}
