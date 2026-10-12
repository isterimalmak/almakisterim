import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { SESSION_COOKIE, SESSION_DAYS, setSessionCookie, type Deps } from "../context.js";
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

export function authRoutes(app: FastifyInstance, { config, pool, mailer, sms, google }: Deps) {
  const hashCode = (target: string, code: string) => sha256(`${config.CODE_PEPPER}:${target}:${code}`);
  const roleFor = (email: string | null, phone: string | null) =>
    (email && config.adminEmails.has(email)) || (phone && config.adminPhones.has(phone)) ? "admin" : "user";

  // 1) Kod iste: SMS veya e-posta ile 6 haneli kod gönderilir.
  app.post("/auth/code", { config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } }, async (req) => {
    const body = z.object({ channel: Channel, target: z.string().max(254) }).parse(req.body);
    const target = normalize(body.channel, body.target);
    const recent = await pool.query<{ last_min: number; hour_count: number }>(
      `SELECT COALESCE(EXTRACT(EPOCH FROM now() - max(created_at)) / 60, 999)::float AS last_min,
              count(*) FILTER (WHERE created_at > now() - interval '1 hour')::int AS hour_count
         FROM auth_codes WHERE channel = $1 AND target = $2`,
      [body.channel, target],
    );
    const r = recent.rows[0]!;
    if (r.last_min < 1) throw new HttpError(429, "cok_sik", "Yeni kod istemek için 1 dakika bekleyin.");
    if (r.hour_count >= 5) throw new HttpError(429, "cok_fazla", "Çok fazla kod istendi. Bir saat sonra tekrar deneyin.");

    const code = sixDigitCode();
    await pool.query(
      `INSERT INTO auth_codes (channel, target, code_hash, expires_at) VALUES ($1, $2, $3, now() + make_interval(mins => $4))`,
      [body.channel, target, hashCode(target, code), CODE_TTL_MIN],
    );
    const text = `almakisterim giriş kodunuz: ${code}. Kod ${CODE_TTL_MIN} dakika geçerlidir, kimseyle paylaşmayın.`;
    if (body.channel === "sms") await sms.send(target, text);
    else await mailer.send(target, "almakisterim giriş kodunuz", text);
    return { ok: true, sent_to: maskTarget(body.channel, target) };
  });

  // 2) Kodu doğrula: doğruysa kullanıcı bulunur ya da açılır ve oturum başlar.
  app.post("/auth/verify", { config: { rateLimit: { max: 20, timeWindow: "10 minutes" } } }, async (req, reply) => {
    const body = z.object({ channel: Channel, target: z.string().max(254), code: z.string().regex(/^\d{6}$/), name: z.string().max(80).optional() }).parse(req.body);
    const target = normalize(body.channel, body.target);
    const { rows } = await pool.query<{ id: string; code_hash: string; attempts: number }>(
      `SELECT id, code_hash, attempts FROM auth_codes
        WHERE channel = $1 AND target = $2 AND consumed_at IS NULL AND expires_at > now()
        ORDER BY created_at DESC LIMIT 1`,
      [body.channel, target],
    );
    const row = rows[0];
    const fail = new HttpError(400, "kod_hatali", "Kod hatalı veya süresi dolmuş.");
    if (!row || row.attempts >= MAX_ATTEMPTS) throw fail;
    if (!safeEqual(row.code_hash, hashCode(target, body.code))) {
      await pool.query("UPDATE auth_codes SET attempts = attempts + 1 WHERE id = $1", [row.id]);
      throw fail;
    }
    await pool.query("UPDATE auth_codes SET consumed_at = now() WHERE id = $1", [row.id]);

    const col = body.channel === "sms" ? "phone" : "email";
    const email = body.channel === "email" ? target : null, phone = body.channel === "sms" ? target : null;
    const user = await pool.query<{ id: string }>(
      `INSERT INTO users (${col}, name, role) VALUES ($1, $2, $3)
       ON CONFLICT (${col}) DO UPDATE SET name = CASE WHEN users.name = '' THEN EXCLUDED.name ELSE users.name END,
                                         role = CASE WHEN EXCLUDED.role = 'admin' THEN 'admin' ELSE users.role END
       RETURNING id`,
      [target, (body.name ?? "").trim(), roleFor(email, phone)],
    );
    const token = await createSession(pool, user.rows[0]!.id);
    setSessionCookie(reply, token, config.isProd);
    return { ok: true };
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
