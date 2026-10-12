import type { Deps } from "../context.js";

type Contact = { email: string | null; phone: string | null };

// Kullanıcıya SMS (telefon varsa) veya e-posta ile kısa bildirim gönderir. Hata akışı durdurmaz.
export async function notifyUser({ sms, mailer }: Pick<Deps, "sms" | "mailer">, to: Contact, subject: string, text: string) {
  if (to.phone) await sms.send(to.phone, text);
  else if (to.email) await mailer.send(to.email, subject, text);
}

// Yeni talep yayına girince alarmı uyan satıcılara haber verilir.
export async function notifyAlarmMatches(deps: Deps, requestId: number) {
  const { pool, config } = deps;
  const { rows } = await pool.query<Contact & { title: string; budget_max: number }>(
    `SELECT DISTINCT ON (u.id) u.email, u.phone, r.title, r.budget_max
       FROM requests r
       JOIN categories c ON c.id = r.category_id
       JOIN alarms a ON (a.category_id = c.id OR a.category_id = c.parent_id)
       JOIN users u ON u.id = a.user_id
      WHERE r.id = $1 AND u.id <> r.buyer_id
        AND (a.city = '' OR a.city = r.city) AND r.budget_max >= a.min_budget
      LIMIT 500`, [requestId]);
  for (const m of rows) {
    const text = `almakisterim: alarmınıza uyan yeni talep: "${m.title}" (bütçe ${m.budget_max.toLocaleString("tr-TR")} TL). ${config.APP_URL}/talep/${requestId}`;
    await notifyUser(deps, m, "Size uygun yeni bir talep var", text).catch(() => {});
  }
}
