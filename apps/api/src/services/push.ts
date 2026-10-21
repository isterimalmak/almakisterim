import type { Client, Pool } from "../db.js";

// Telefon uygulamasına anlık bildirim (Expo Push). Bildirim adresi uygulama girişte kaydeder (POST /me/push-token).
// Gönderim isteği akışı durdurmaz: hata olursa sessizce geçilir, geçersiz adres silinir.
const EXPO_PUSH = "https://exp.host/--/api/v2/push/send";

export async function sendPush(db: Pool | Client, userId: string, body: string, link = "") {
  const tokens = (await db.query<{ token: string }>("SELECT token FROM push_tokens WHERE user_id = $1", [userId])).rows.map((r) => r.token);
  if (!tokens.length) return;
  const res = await fetch(EXPO_PUSH, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(tokens.map((to) => ({ to, title: "almakisterim", body: body.slice(0, 180), sound: "default", data: { link } }))),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) return;
  const out = (await res.json().catch(() => ({}))) as { data?: { status?: string; details?: { error?: string } }[] };
  const gone = (out.data ?? []).map((d, i) => (d.details?.error === "DeviceNotRegistered" ? tokens[i] : null)).filter(Boolean);
  if (gone.length) await db.query("DELETE FROM push_tokens WHERE token = ANY($1::text[])", [gone]);
}
