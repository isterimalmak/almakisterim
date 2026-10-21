import { aiSettings, logAiAction } from "../services/ai-guard.js";
import { welcomeEmail } from "./notifications.js";
import { mailEvent } from "./mailstudio.js";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { requireUser, SESSION_COOKIE, SESSION_DAYS, setSessionCookie, type Deps } from "../context.js";
import type { Client, Pool } from "../db.js";
import { HttpError, maskTarget, normalizeEmail, normalizePhone, randomToken, safeEqual, sha256, sixDigitCode } from "../lib/util.js";

const CODE_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const STATE_COOKIE = "ak_oauth_state";

const Channel = z.enum(["email", "sms"]);

function normalize(channel: "email" | "sms", raw: string): string {
  const v = channel === "sms" ? normalizePhone(raw) : normalizeEmail(raw);
  if (!v) throw new HttpError(400, "gecersiz_hedef", channel === "sms" ? "Geçerli bir cep telefonu numarası yazın." : "Geçerli bir e-posta adresi yazın.");
  return v;
}

async function createSession(db: Pool | Client, userId: string): Promise<string> {
  const token = randomToken();
  await db.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + make_interval(days => $3))`,
    [userId, sha256(token), SESSION_DAYS],
  );
  return token;
}

// Tek kullanımlık SMS/e-posta kodları: girişte, telefon eklemede ve talep yayınlarken (requests.ts) kullanılır.
export function codeService(deps: Deps) {
  const { config, pool, mailer, sms } = deps;
  const hashCode = (target: string, code: string) => sha256(`${config.CODE_PEPPER}:${target}:${code}`);

  // Kod üretir, gönderir; aynı hedefe dakikada 1, saatte 5 kod.
  async function issueCode(req: FastifyRequest, channel: "email" | "sms", target: string, purpose: string) {
    const recent = await pool.query<{ last_min: number; hour_count: number }>(
      // "1 dakika bekleyin" yalnız henüz kullanılmamış kod için: girişten hemen sonra talep onay kodu istenebilsin.
      `SELECT COALESCE(EXTRACT(EPOCH FROM now() - max(created_at) FILTER (WHERE consumed_at IS NULL)) / 60, 999)::float AS last_min,
              count(*) FILTER (WHERE created_at > now() - interval '1 hour')::int AS hour_count
         FROM auth_codes WHERE channel = $1 AND target = $2`,
      [channel, target],
    );
    const r = recent.rows[0]!;
    if (r.last_min < 1) throw new HttpError(429, "cok_sik", "Yeni kod istemek için 1 dakika bekleyin.");
    if (r.hour_count >= 5) throw new HttpError(429, "cok_fazla", "Çok fazla kod istendi. Bir saat sonra tekrar deneyin.");

    const code = sixDigitCode();
    const ins = await pool.query<{ id: string }>(
      `INSERT INTO auth_codes (channel, target, code_hash, expires_at) VALUES ($1, $2, $3, now() + make_interval(mins => $4)) RETURNING id`,
      [channel, target, hashCode(target, code), CODE_TTL_MIN],
    );
    const text = `almakisterim ${purpose} kodunuz: ${code}. Kod ${CODE_TTL_MIN} dakika geçerlidir, kimseyle paylaşmayın.`;
    try {
      if (channel === "sms") await sms.send(target, text);
      else await mailer.send(target, `almakisterim ${purpose} kodunuz`, text, { critical: true });
    } catch (e) {
      // Gönderilemeyen kod geçersiz sayılır; kullanıcı beklemeden tekrar deneyebilir.
      await pool.query("DELETE FROM auth_codes WHERE id = $1", [ins.rows[0]!.id]);
      if (e instanceof HttpError) throw e;
      req.log.error({ err: (e as Error).message, channel }, "kod gönderilemedi");
      throw new HttpError(502, "gonderilemedi", "Kod gönderilemedi, lütfen biraz sonra tekrar deneyin.");
    }
    return { ok: true, sent_to: maskTarget(channel, target) };
  }

  // Kodu kontrol eder ve tüketir; hatalıysa deneme sayısını artırır.
  async function consumeCode(channel: "email" | "sms", target: string, code: string) {
    const { rows } = await pool.query<{ id: string; code_hash: string; attempts: number }>(
      `SELECT id, code_hash, attempts FROM auth_codes
        WHERE channel = $1 AND target = $2 AND consumed_at IS NULL AND expires_at > now()
        ORDER BY created_at DESC LIMIT 1`,
      [channel, target],
    );
    const row = rows[0];
    const fail = new HttpError(400, "kod_hatali", "Kod hatalı veya süresi dolmuş.");
    if (!row || row.attempts >= MAX_ATTEMPTS) throw fail;
    if (!safeEqual(row.code_hash, hashCode(target, code))) {
      await pool.query("UPDATE auth_codes SET attempts = attempts + 1 WHERE id = $1", [row.id]);
      throw fail;
    }
    await pool.query("UPDATE auth_codes SET consumed_at = now() WHERE id = $1", [row.id]);
  }

  // Talep yayınlarken: hesapta numara varsa yalnız o numara yazılabilir; yoksa yazılan numara başka hesaba bağlı olmamalı.
  async function publishPhone(user: { id: string; phone: string | null }, raw: string | undefined) {
    if (!raw?.trim()) throw new HttpError(400, "telefon_onayi_gerekli", "Talebi yayınlamak için cep telefonunuza gelen doğrulama kodunu girin.");
    const phone = normalize("sms", raw);
    if (user.phone && user.phone !== phone) throw new HttpError(400, "numara_farkli", `Hesabınızda kayıtlı numarayı yazın (${maskTarget("sms", user.phone)}).`);
    if (!user.phone && (await pool.query("SELECT 1 FROM users WHERE phone = $1 AND id <> $2", [phone, user.id])).rowCount)
      throw new HttpError(409, "numara_kullanimda", "Bu numara başka bir hesaba bağlı. O numarayla SMS ile giriş yapabilirsiniz.");
    return phone;
  }

  return { issueCode, consumeCode, publishPhone };
}

export function authRoutes(app: FastifyInstance, deps: Deps) {
  const { config, pool, google } = deps;
  const { issueCode, consumeCode, publishPhone } = codeService(deps);
  const roleFor = (email: string | null, phone: string | null) =>
    (email && config.adminEmails.has(email)) || (phone && config.adminPhones.has(phone)) ? "admin" : "user";

  // 1) Kod iste: SMS veya e-posta ile 6 haneli kod gönderilir.
  app.post("/auth/code", { config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } }, async (req) => {
    const body = z.object({ channel: Channel, target: z.string().max(254) }).parse(req.body);
    return issueCode(req, body.channel, normalize(body.channel, body.target), "giriş");
  });

  // Uygunsuz ad kullanılamaz (yönetim → Yapay Zekâ → "Üye adlarını denetle").
  async function assertName(name: string) {
    if (!(await aiSettings(pool)).names) return;
    const r = await deps.ai.checkName(name);
    if (r.verdict === "block") {
      await logAiAction(pool, { kind: "ad_engel", target: "", summary: `"${name.slice(0, 60)}" adı engellendi: ${r.reason}` });
      throw new HttpError(400, "ad_uygunsuz", `Bu ad kullanılamaz${r.reason ? `: ${r.reason}` : ""}. Lütfen gerçek adınızı veya firma adınızı yazın.`);
    }
  }

  // 2) Kodu doğrula: doğruysa kullanıcı bulunur ya da açılır ve oturum başlar.
  app.post("/auth/verify", { config: { rateLimit: { max: 20, timeWindow: "10 minutes" } } }, async (req, reply) => {
    const body = z.object({ channel: Channel, target: z.string().max(254), code: z.string().regex(/^\d{6}$/), name: z.string().max(80).optional() }).parse(req.body);
    const target = normalize(body.channel, body.target);
    // Ad yapay zekâ ile denetlenir (küfür, kurum taklidi, ad yerine reklam); kod harcanmadan önce.
    // Yalnızca adı henüz olmayan (yeni) üyede: mevcut üyenin adı girişte değişmez.
    const colName = body.channel === "sms" ? "phone" : "email";
    const known = (await pool.query(`SELECT 1 FROM users WHERE ${colName} = $1 AND name <> ''`, [target])).rowCount;
    if (body.name?.trim() && !known) await assertName(body.name.trim());
    await consumeCode(body.channel, target, body.code);

    const col = body.channel === "sms" ? "phone" : "email";
    const email = body.channel === "email" ? target : null, phone = body.channel === "sms" ? target : null;
    const user = await pool.query<{ id: string; inserted: boolean }>(
      `INSERT INTO users (${col}, name, role) VALUES ($1, $2, $3)
       ON CONFLICT (${col}) DO UPDATE SET name = CASE WHEN users.name = '' THEN EXCLUDED.name ELSE users.name END,
                                         role = CASE WHEN EXCLUDED.role = 'admin' THEN 'admin' ELSE users.role END
       RETURNING id, (xmax = 0) AS inserted`,
      [target, (body.name ?? "").trim(), roleFor(email, phone)],
    );
    if (user.rows[0]!.inserted) {
      void welcomeEmail(deps, user.rows[0]!.id).catch(() => {});
      // E-posta Stüdyosu: "Yeni üye olunca" görevleri sıraya girer (hata girişi bozmaz)
      await mailEvent(pool, "signup", user.rows[0]!.id);
    }
    const token = await createSession(pool, user.rows[0]!.id);
    setSessionCookie(reply, token, config.isProd);
    return { ok: true };
  });

  // Hesaba telefon ekleme (Google veya e-posta ile girenler için): talep vermek için doğrulanmış numara gerekir.
  const phoneOf = (raw: string) => normalize("sms", raw);
  async function phoneTaken(phone: string, userId: string) {
    return !!(await pool.query("SELECT 1 FROM users WHERE phone = $1 AND id <> $2", [phone, userId])).rowCount;
  }
  app.post("/me/phone/code", { config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } }, async (req) => {
    const user = requireUser(req);
    const phone = phoneOf(z.object({ phone: z.string().max(30) }).parse(req.body).phone);
    if (await phoneTaken(phone, user.id)) throw new HttpError(409, "numara_kullanimda", "Bu numara başka bir hesaba bağlı. O numarayla SMS ile giriş yapabilirsiniz.");
    return issueCode(req, "sms", phone, "telefon doğrulama");
  });
  app.post("/me/phone/verify", { config: { rateLimit: { max: 20, timeWindow: "10 minutes" } } }, async (req) => {
    const user = requireUser(req);
    const b = z.object({ phone: z.string().max(30), code: z.string().regex(/^\d{6}$/) }).parse(req.body);
    const phone = phoneOf(b.phone);
    await consumeCode("sms", phone, b.code);
    if (await phoneTaken(phone, user.id)) throw new HttpError(409, "numara_kullanimda", "Bu numara başka bir hesaba bağlı.");
    await pool.query("UPDATE users SET phone = $2, role = CASE WHEN $3 THEN 'admin' ELSE role END WHERE id = $1",
      [user.id, phone, config.adminPhones.has(phone)]);
    return { ok: true, phone: maskTarget("sms", phone) };
  });

  // Talep yayınlamadan önce: kayıtlı numaraya (numarası olmayan üyede yazdığı numaraya) onay kodu gider.
  app.post("/me/publish-code", { config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } }, async (req) => {
    const user = requireUser(req);
    const phone = await publishPhone(user, z.object({ phone: z.string().max(30) }).parse(req.body).phone);
    return issueCode(req, "sms", phone, "talep onay");
  });

  // 3) Google ile devam et.
  app.get("/auth/google", async (req, reply) => {
    if (!google.enabled) throw new HttpError(503, "google_kapali", "Google ile giriş henüz açılmadı.");
    const state = randomToken();
    reply.setCookie(STATE_COOKIE, state, { httpOnly: true, secure: config.isProd, sameSite: "lax", path: "/api/auth", maxAge: 600 });
    return reply.redirect(google.authUrl(state, `${config.APP_URL}/api/auth/google/callback`));
  });

  app.get("/auth/google/callback", async (req, reply) => {
    const q = z.object({ code: z.string().optional(), state: z.string().optional(), error: z.string().optional() }).parse(req.query);
    const expected = req.cookies[STATE_COOKIE];
    reply.clearCookie(STATE_COOKIE, { path: "/api/auth" });
    if (q.error || !q.code || !q.state || !expected || !safeEqual(q.state, expected)) {
      return reply.redirect(`${config.APP_URL}/giris?hata=google`);
    }
    try {
      const g = await google.exchange(q.code, `${config.APP_URL}/api/auth/google/callback`);
      // Aynı e-postayla daha önce kod ile giriş yapılmışsa o hesap Google'a bağlanır.
      const existing = await pool.query<{ id: string }>(
        `UPDATE users SET google_sub = $1 WHERE google_sub = $1 OR (google_sub IS NULL AND email = $2 AND $2 IS NOT NULL)
         RETURNING id`, [g.sub, g.email]);
      let userId = existing.rows[0]?.id;
      if (!userId) {
        const ins = await pool.query<{ id: string }>(
          `INSERT INTO users (google_sub, email, name, role) VALUES ($1, $2, $3, $4) RETURNING id`,
          [g.sub, g.email, g.name, roleFor(g.email, null)]);
        userId = ins.rows[0]!.id;
        void welcomeEmail(deps, userId).catch(() => {});
        await mailEvent(pool, "signup", userId);
      }
      setSessionCookie(reply, await createSession(pool, userId), config.isProd);
      return reply.redirect(`${config.APP_URL}/`);
    } catch (e) {
      req.log.warn({ err: (e as Error).message }, "google girişi başarısız");
      return reply.redirect(`${config.APP_URL}/giris?hata=google`);
    }
  });

  app.post("/auth/logout", async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) await pool.query("DELETE FROM sessions WHERE token_hash = $1", [sha256(token)]);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/auth/providers", async () => ({ google: google.enabled }));
}
