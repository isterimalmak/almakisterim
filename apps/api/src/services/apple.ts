import { createPublicKey, verify, type JsonWebKey } from "node:crypto";

// "Apple ile Giriş": iPhone uygulaması Apple'dan aldığı kimlik jetonunu (identityToken, RS256 JWT) gönderir.
// İmza Apple'ın açık anahtarlarıyla, alıcı (aud) uygulamanın Bundle ID'siyle, süre ve yayıncı (iss) kontrol edilir.
const KEYS_URL = "https://appleid.apple.com/auth/keys";
let keys: { at: number; list: (JsonWebKey & { kid: string })[] } | null = null;

async function appleKeys(force = false) {
  if (!force && keys && Date.now() - keys.at < 6 * 3600e3) return keys.list;
  const res = await fetch(KEYS_URL, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Apple anahtarları alınamadı (${res.status})`);
  keys = { at: Date.now(), list: ((await res.json()) as { keys: (JsonWebKey & { kid: string })[] }).keys };
  return keys.list;
}

const b64 = (s: string) => Buffer.from(s, "base64url");

export async function verifyAppleToken(token: string, audience: string): Promise<{ sub: string; email: string | null }> {
  const [h, p, sig] = token.split(".");
  if (!h || !p || !sig) throw new Error("Apple jetonu bozuk");
  const header = JSON.parse(b64(h).toString()) as { kid?: string; alg?: string };
  if (header.alg !== "RS256" || !header.kid) throw new Error("Apple jetonu desteklenmiyor");
  let jwk = (await appleKeys()).find((k) => k.kid === header.kid);
  if (!jwk) jwk = (await appleKeys(true)).find((k) => k.kid === header.kid); // Apple anahtarlarını döndürmüş olabilir
  if (!jwk) throw new Error("Apple anahtarı bulunamadı");
  const ok = verify("RSA-SHA256", Buffer.from(`${h}.${p}`), createPublicKey({ key: jwk, format: "jwk" }), b64(sig));
  if (!ok) throw new Error("Apple imzası geçersiz");
  const c = JSON.parse(b64(p).toString()) as { iss?: string; aud?: string; exp?: number; sub?: string; email?: string; email_verified?: boolean | string };
  if (c.iss !== "https://appleid.apple.com" || c.aud !== audience || !c.sub || !c.exp || c.exp * 1000 < Date.now()) throw new Error("Apple kimliği bu uygulamaya ait değil ya da süresi dolmuş");
  const verified = c.email_verified === true || c.email_verified === "true";
  return { sub: c.sub, email: verified && c.email ? c.email.toLowerCase() : null };
}
