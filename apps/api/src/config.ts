import { z } from "zod";

// Ortam değişkenleri. Gizli değerler (anahtarlar, şifreler) üretimde Google Secret
// Manager'dan Cloud Run'a ortam değişkeni olarak verilir; koda ve depoya yazılmaz.
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(8080),
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  CODE_PEPPER: z.string().min(16).default("gelistirme-icin-gizli-olmayan-deger"),
  ADMIN_EMAILS: z.string().default(""),
  ADMIN_PHONES: z.string().default(""),
  JOB_TOKEN: z.string().default(""),

  RESEND_API_KEY: z.string().default(""),
  MAIL_FROM: z.string().default("almakisterim <bildirim@almakisterim.com>"),

  NETGSM_USERCODE: z.string().default(""),
  NETGSM_PASSWORD: z.string().default(""),
  NETGSM_HEADER: z.string().default(""),

  ANTHROPIC_API_KEY: z.string().default(""),
  PEXELS_API_KEY: z.string().default(""),
  PIXABAY_API_KEY: z.string().default(""),
  CLAUDE_MODEL: z.string().default("claude-opus-5-5"),

  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),

  // Cloudflare R2 (fotoğraf ve video). Anahtarlar Secret Manager'da; hesap kimliği, depo adı ve genel adres gizli değil.
  R2_ACCOUNT_ID: z.string().default(""),
  R2_ACCESS_KEY_ID: z.string().default(""),
  R2_SECRET_ACCESS_KEY: z.string().default(""),
  R2_BUCKET: z.string().default("almakisterim-media"),
  R2_PUBLIC_URL: z.string().default(""),
});

export type Config = z.infer<typeof schema> & {
  adminEmails: Set<string>;
  adminPhones: Set<string>;
  isProd: boolean;
};

export function loadConfig(rawEnv: NodeJS.ProcessEnv = process.env): Config {
  // Secret Manager'da henüz doldurulmamış anahtarlar tek boşlukla tutulur; boşluk "yok" sayılır.
  const env = Object.fromEntries(Object.entries(rawEnv).map(([k, v]) => [k, v?.trim() || undefined]));
  const parsed = schema.parse(env);
  const isProd = parsed.NODE_ENV === "production";
  if (isProd) {
    // SMS, e-posta ve yapay zekâ anahtarları sonradan eklenebilir; eksikken ilgili özellik kapalı kalır.
    const required = ["CODE_PEPPER", "JOB_TOKEN"] as const;
    const missing = required.filter((k) => !env[k]);
    if (missing.length) {
      // Yalnızca eksik değişkenlerin ADI yazılır, değerleri asla.
      throw new Error(`Eksik ortam değişkenleri: ${missing.join(", ")}`);
    }
  }
  const list = (s: string) => new Set(s.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean));
  return { ...parsed, adminEmails: list(parsed.ADMIN_EMAILS), adminPhones: list(parsed.ADMIN_PHONES), isProd };
}
