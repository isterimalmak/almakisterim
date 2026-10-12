import { createHash, createHmac, randomUUID } from "node:crypto";
import type { Config } from "../config.js";
import { HttpError } from "../lib/util.js";

// Fotoğraf ve video deposu. Üretimde Cloudflare R2 (S3 uyumlu). Tarayıcı dosyayı, sunucunun verdiği
// kısa ömürlü imzalı adrese doğrudan yükler; R2 anahtarları tarayıcıya hiç gitmez.
export type UploadTicket = { url: string; method: "PUT"; headers: Record<string, string>; expires_in: number };

export interface MediaStorage {
  readonly enabled: boolean;
  presignPut(key: string, contentType: string, size: number): UploadTicket;
  head(key: string): Promise<{ size: number; contentType: string } | null>;
  remove(key: string): Promise<void>;
  publicUrl(key: string): string;
}

/* ---------------- AWS Signature V4 (R2 bunu kullanır) ---------------- */

const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
const hex = (d: string | Buffer) => createHash("sha256").update(d).digest("hex");
const hmac = (k: string | Buffer, d: string) => createHmac("sha256", k).update(d).digest();
export const EMPTY_SHA256 = hex("");

export type SignInput = {
  method: string; host: string; path: string; query?: Record<string, string>; headers?: Record<string, string>;
  payloadHash: string; region: string; service: string; accessKeyId: string; secret: string; now: Date;
  presignExpires?: number;
};

export function amzDate(now: Date) {
  const full = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return { full, day: full.slice(0, 8) };
}

// Kanonik isteği oluşturup imzalar. presignExpires verilirse imza adrese (sorgu parametrelerine) konur.
export function signV4(i: SignInput) {
  const { full, day } = amzDate(i.now);
  const scope = `${day}/${i.region}/${i.service}/aws4_request`;
  const headers: Record<string, string> = { host: i.host };
  for (const [k, v] of Object.entries(i.headers ?? {})) headers[k.toLowerCase()] = String(v).trim();
  const names = Object.keys(headers).sort();
  const signedHeaders = names.join(";");
  const query: Record<string, string> = { ...(i.query ?? {}) };
  if (i.presignExpires !== undefined) {
    Object.assign(query, {
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": `${i.accessKeyId}/${scope}`,
      "X-Amz-Date": full,
      "X-Amz-Expires": String(i.presignExpires),
      "X-Amz-SignedHeaders": signedHeaders,
    });
  }
  const canonicalQuery = Object.keys(query).sort().map((k) => `${enc(k)}=${enc(query[k]!)}`).join("&");
  const canonical = [i.method, i.path, canonicalQuery, names.map((n) => `${n}:${headers[n]}\n`).join(""), signedHeaders, i.payloadHash].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", full, scope, hex(canonical)].join("\n");
  const key = hmac(hmac(hmac(hmac(`AWS4${i.secret}`, day), i.region), i.service), "aws4_request");
  const signature = createHmac("sha256", key).update(toSign).digest("hex");
  return {
    signature, canonicalQuery, amzDate: full,
    authorization: `AWS4-HMAC-SHA256 Credential=${i.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

export class R2Storage implements MediaStorage {
  readonly enabled = true;
  private host: string;
  constructor(private o: { accountId: string; accessKeyId: string; secret: string; bucket: string; publicBase: string }, private now = () => new Date()) {
    this.host = `${o.accountId}.r2.cloudflarestorage.com`;
  }
  private path(key: string) { return `/${enc(this.o.bucket)}/${key.split("/").map(enc).join("/")}`; }
  private base(method: string, key: string, headers: Record<string, string>, payloadHash: string, presignExpires?: number) {
    return signV4({ method, host: this.host, path: this.path(key), headers, payloadHash, region: "auto", service: "s3",
      accessKeyId: this.o.accessKeyId, secret: this.o.secret, now: this.now(), presignExpires });
  }

  presignPut(key: string, contentType: string, size: number): UploadTicket {
    const expires = 600;
    // Boyut ve tür imzaya dahildir: tarayıcı farklı bir dosya gönderirse R2 yüklemeyi reddeder.
    const headers = { "content-length": String(size), "content-type": contentType };
    const s = this.base("PUT", key, headers, "UNSIGNED-PAYLOAD", expires);
    return { url: `https://${this.host}${this.path(key)}?${s.canonicalQuery}&X-Amz-Signature=${s.signature}`, method: "PUT", headers: { "Content-Type": contentType }, expires_in: expires };
  }

  private async call(method: "HEAD" | "DELETE", key: string) {
    const s = this.base(method, key, { "x-amz-content-sha256": EMPTY_SHA256, "x-amz-date": amzDate(this.now()).full }, EMPTY_SHA256);
    return fetch(`https://${this.host}${this.path(key)}`, {
      method, headers: { Authorization: s.authorization, "x-amz-content-sha256": EMPTY_SHA256, "x-amz-date": s.amzDate },
    });
  }

  async head(key: string) {
    const res = await this.call("HEAD", key);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`R2 HEAD hata kodu ${res.status}`);
    return { size: Number(res.headers.get("content-length") ?? 0), contentType: res.headers.get("content-type") ?? "" };
  }

  async remove(key: string) {
    const res = await this.call("DELETE", key);
    if (!res.ok && res.status !== 404) throw new Error(`R2 DELETE hata kodu ${res.status}`);
  }

  publicUrl(key: string) { return `${this.o.publicBase.replace(/\/$/, "")}/${key}`; }
}

// Geliştirme ve testlerde dosyalar bellekte tutulur ve API üzerinden sunulur.
export class MemoryStorage implements MediaStorage {
  readonly enabled = true;
  readonly files = new Map<string, { body: Buffer; contentType: string }>();
  private tickets = new Map<string, { contentType: string; size: number; expires: number }>();

  presignPut(key: string, contentType: string, size: number): UploadTicket {
    const token = randomUUID();
    this.tickets.set(token, { contentType, size, expires: Date.now() + 600_000 });
    return { url: `/api/__media/upload/${key}?t=${token}`, method: "PUT", headers: { "Content-Type": contentType }, expires_in: 600 };
  }

  // Bellek deposunda yükleme; R2'deki imza kontrolünün aynısını yapar.
  accept(key: string, token: string, contentType: string, body: Buffer) {
    const t = this.tickets.get(token);
    if (!t || t.expires < Date.now() || t.contentType !== contentType || t.size !== body.length) return false;
    this.tickets.delete(token);
    this.files.set(key, { body, contentType });
    return true;
  }

  async head(key: string) {
    const f = this.files.get(key);
    return f ? { size: f.body.length, contentType: f.contentType } : null;
  }
  async remove(key: string) { this.files.delete(key); }
  publicUrl(key: string) { return `/api/__media/file/${key}`; }
}

export const disabledStorage: MediaStorage = {
  enabled: false,
  presignPut() { throw new HttpError(503, "yukleme_kapali", "Fotoğraf ve video yükleme şu anda kullanılamıyor."); },
  async head() { return null; },
  async remove() {},
  publicUrl(key: string) { return key; },
};

export function createStorage(config: Config): MediaStorage {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL } = config;
  if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_PUBLIC_URL) {
    return new R2Storage({ accountId: R2_ACCOUNT_ID, accessKeyId: R2_ACCESS_KEY_ID, secret: R2_SECRET_ACCESS_KEY, bucket: R2_BUCKET, publicBase: R2_PUBLIC_URL });
  }
  // Üretimde R2 ayarlanmamışsa yükleme kapalı kalır; geliştirmede bellek deposu kullanılır.
  return config.isProd ? disabledStorage : new MemoryStorage();
}
