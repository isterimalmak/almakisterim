import type { Deps } from "../context.js";
import { alarmOwnersFor } from "./alarms.js";

type Contact = { email: string | null; phone: string | null };

// Kullanıcıya SMS (telefon varsa) veya e-posta ile kısa bildirim gönderir. Hata akışı durdurmaz.
export async function notifyUser({ sms, mailer }: Pick<Deps, "sms" | "mailer">, to: Contact, subject: string, text: string) {
  if (to.phone) await sms.send(to.phone, text);
  else if (to.email) await mailer.send(to.email, subject, text);
}

// Yeni talep yayına girince alarmı (kaydedilmiş araması) uyan satıcılara haber verilir.
export async function notifyAlarmMatches(deps: Deps, requestId: number) {
  const { pool, config } = deps;
  const owners = await alarmOwnersFor(pool, requestId);
  if (!owners.length) return;
  const r = (await pool.query<{ title: string; budget_max: number }>("SELECT title, budget_max FROM requests WHERE id = $1", [requestId])).rows[0];
  if (!r) return;
  const { rows } = await pool.query<Contact & { id: string }>("SELECT id, email, phone FROM users WHERE id = ANY($1::uuid[])", [owners]);
  const text = `almakisterim: alarmınıza uyan yeni talep: "${r.title}" (bütçe ${r.budget_max.toLocaleString("tr-TR")} TL). ${config.APP_URL}/talep/${requestId}`;
  for (const m of rows) {
    // Site içi bildirim her zaman; SMS/e-posta bağlıysa ayrıca.
    await pool.query("INSERT INTO notifications (user_id, text, link) VALUES ($1, $2, $3)", [m.id, `Alarmınıza uyan yeni talep: "${r.title}"`, `/talep/${requestId}`]).catch(() => {});
    await notifyUser(deps, m, "Size uygun yeni bir talep var", text).catch(() => {});
  }
}
