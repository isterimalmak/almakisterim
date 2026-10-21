import type { FastifyBaseLogger } from "fastify";
import type { Pool } from "../db.js";
import type { Mailer } from "./notify.js";

// Resend ücretsiz plan sınırları (resend.com/pricing): günde 100, ayda 3.000 e-posta. Sınır dolunca Resend göndermeyi durdurur.
export const MAIL_LIMITS = { day: 100, month: 3000 };
// Günlük sınırın son 10'u giriş kodlarına ayrılır: bildirimler ve kampanyalar 90'da durur, üyeler yine giriş yapabilir.
const RESERVE = 10;
const WARN = 0.8;

export async function mailUsage(pool: Pool) {
  const r = (await pool.query<{ day: number; month: number }>(
    `SELECT coalesce(sum(n) FILTER (WHERE day = current_date), 0)::int AS day,
            coalesce(sum(n), 0)::int AS month
       FROM mail_usage WHERE day >= date_trunc('month', current_date)`)).rows[0]!;
  return { day: r.day, month: r.month, limits: MAIL_LIMITS, warn: r.day >= MAIL_LIMITS.day * WARN || r.month >= MAIL_LIMITS.month * WARN };
}

/** Gönderilen e-postaları sayar; Resend açıkken sınıra yaklaşınca yöneticiyi uyarır, sınırda yalnız giriş kodlarını (critical) geçirir. */
export function metered(m: Mailer, pool: Pool, limited: () => boolean, log?: FastifyBaseLogger): Mailer {
  return {
    async send(to, subject, text, opts = {}) {
      if (limited()) {
        const u = await mailUsage(pool);
        const full = u.day >= MAIL_LIMITS.day - (opts.critical ? 0 : RESERVE) || u.month >= MAIL_LIMITS.month - (opts.critical ? 0 : RESERVE);
        if (full) {
          log?.warn({ day: u.day, month: u.month }, "e-posta sınırı doldu, gönderilmedi");
          throw new Error("e-posta gönderim sınırı doldu");
        }
      }
      await m.send(to, subject, text, opts);
      const n = (await pool.query<{ n: number }>(
        "INSERT INTO mail_usage (day, n) VALUES (current_date, 1) ON CONFLICT (day) DO UPDATE SET n = mail_usage.n + 1 RETURNING n")).rows[0]!.n;
      if (!limited()) return;
      const month = (await mailUsage(pool)).month;
      const hit = n === MAIL_LIMITS.day * WARN ? `Bugün ${n} e-posta gönderildi; günlük sınır ${MAIL_LIMITS.day}.`
        : month === MAIL_LIMITS.month * WARN ? `Bu ay ${month} e-posta gönderildi; aylık sınır ${MAIL_LIMITS.month}.` : null;
      if (hit) await pool.query(
        `INSERT INTO notifications (user_id, text, link) SELECT id, $1, '/yonetim/eposta' FROM users WHERE role = 'admin'`,
        [`E-posta sınırına yaklaşıldı: ${hit} Sınır dolunca yalnız giriş kodları gider. Gerekirse Resend'de ücretli plana geçin.`]).catch(() => {});
    },
  };
}
