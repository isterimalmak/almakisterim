import type { Deps } from "../context.js";
import { alarmOwnersFor } from "./alarms.js";
import { aiSettings } from "../services/ai-guard.js";

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

/* ---------------- Otomatik e-postalar (yönetim → Yapay Zekâ → "Otomatik e-postalar") ---------------- */
// Yalnızca e-postası olan üyelere gider (SMS ücretli olduğu için kullanılmaz). E-posta hizmeti bağlı değilse sessizce atlanır.

async function autoMail(deps: Deps, userId: string, subject: string, text: string) {
  const { pool, mailer } = deps;
  if (!(await aiSettings(pool)).autoEmails) return false;
  const u = (await pool.query<{ email: string | null; name: string }>("SELECT email, name FROM users WHERE id = $1", [userId])).rows[0];
  if (!u?.email) return false;
  const hi = u.name ? `Merhaba ${u.name.split(" ")[0]},` : "Merhaba,";
  await mailer.send(u.email, subject, `${hi}\n\n${text}\n\nalmakisterim.com`);
  return true;
}

export async function welcomeEmail(deps: Deps, userId: string) {
  const url = deps.config.APP_URL;
  await autoMail(deps, userId, "almakisterim'e hoş geldiniz",
    `almakisterim'de almak istediğinizi yazarsınız, elinde o ürün olan satıcılar size ulaşır.\n\n` +
    `• Almak istediğiniz bir şey mi var? Ücretsiz talep verin: ${url}/talep-ver\n` +
    `• Satıcı mısınız? Size uygun talep gelince haber almak için alarm kurun: ${url}/bana-ozel?s=alarm`);
}

// Talep durumu değişince sahibine haber: site içi bildirim (zil) her zaman, e-posta otomatik e-postalar açıksa.
// bell: false → talep verilirken (kişi sonucu ekranda zaten görüyor) yalnızca e-posta gider.
export async function requestStatusEmail(deps: Deps, requestId: number, opt: { bell?: boolean } = {}) {
  const r = (await deps.pool.query<{ buyer_id: string; title: string; status: string; moderation_note: string | null }>(
    "SELECT buyer_id, title, status, moderation_note FROM requests WHERE id = $1", [requestId])).rows[0];
  if (!r) return;
  const url = `${deps.config.APP_URL}/talep/${requestId}`;
  const bell = async (text: string, link: string) => {
    if (opt.bell !== false) await deps.pool.query("INSERT INTO notifications (user_id, text, link) VALUES ($1, $2, $3)", [r.buyer_id, text, link]).catch(() => {});
  };
  if (r.status === "active") {
    await bell(`"${r.title}" talebiniz onaylandı ve yayına çıktı.`, `/talep/${requestId}`);
    await autoMail(deps, r.buyer_id, "Talebiniz yayına çıktı", `"${r.title}" talebiniz denetlendi ve yayına alındı. Uygun satıcılar size mesaj atacak ya da arayacak.\n\n${url}`);
  } else if (r.status === "pending_review") {
    await bell(`"${r.title}" talebiniz kısa bir denetimden sonra yayına çıkacak.`, `/talep/${requestId}`);
    await autoMail(deps, r.buyer_id, "Talebiniz denetleniyor", `"${r.title}" talebiniz kısa bir denetimden sonra yayınlanacak. Yayına çıkınca size haber vereceğiz.\n\n${url}`);
  } else if (r.status === "rejected") {
    await bell(`"${r.title}" talebiniz kurallara uymadığı için yayınlanmadı.${r.moderation_note ? ` Neden: ${r.moderation_note}` : ""}`, "/talep-ver");
    await autoMail(deps, r.buyer_id, "Talebiniz yayınlanamadı", `"${r.title}" talebiniz site kurallarına uymadığı için yayınlanmadı.${r.moderation_note ? `\nNeden: ${r.moderation_note}` : ""}\n\nKurallara uygun şekilde yeniden talep verebilirsiniz: ${deps.config.APP_URL}/talep-ver`);
  }
}

// Süresi 2 gün içinde dolacak talepler için bir kez hatırlatma (zamanlanmış saatlik işten çağrılır).
export async function expiryReminders(deps: Deps) {
  const { rows } = await deps.pool.query<{ id: number; buyer_id: string; title: string }>(
    `UPDATE requests SET expiry_reminded_at = now()
      WHERE status = 'active' AND expiry_reminded_at IS NULL AND expires_at > now() AND expires_at < now() + interval '2 days'
      RETURNING id, buyer_id, title`);
  for (const r of rows) {
    await deps.pool.query("INSERT INTO notifications (user_id, text, link) VALUES ($1, $2, $3)", [r.buyer_id, `"${r.title}" talebinizin süresi 2 gün içinde doluyor.`, `/talep/${r.id}`]).catch(() => {});
    await autoMail(deps, r.buyer_id, "Talebinizin süresi dolmak üzere",
      `"${r.title}" talebinizin yayın süresi 2 gün içinde doluyor. Hâlâ arıyorsanız süresi dolunca aynı talebi yeniden verebilirsiniz; aradığınızı bulduysanız talebi kapatabilirsiniz.\n\n${deps.config.APP_URL}/talep/${r.id}`).catch(() => false);
  }
  return rows.length;
}
