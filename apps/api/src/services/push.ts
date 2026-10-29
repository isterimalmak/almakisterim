import type { Client, Pool } from "../db.js";

// Telefon uygulamasına anlık bildirim (Expo Push). Bildirim adresini uygulama girişte kaydeder (POST /me/push-token).
// Gönderim akışı durdurmaz: hata olursa sessizce geçilir, artık geçersiz olan adres silinir.
const EXPO_PUSH = "https://exp.host/--/api/v2/push/send";

// Üyenin uygulamadaki Hesap Bilgileri'nden kapatabildiği bildirim türleri; yazılmayan açık sayılır.
// Türü verilmeyen bildirimler (Güvenli Al ödeme adımları, kredi iadesi gibi) her zaman gider.
export const PUSH_KINDS = ["offer", "accepted", "message", "alarm", "request", "news"] as const;
export type PushKind = (typeof PUSH_KINDS)[number];
export type PushPrefs = Partial<Record<PushKind, boolean>>;
export const wantsPush = (p: PushPrefs | undefined, kind: PushKind) => p?.[kind] !== false;

export type PushMsg = { to: string; title: string; body: string; sound: "default"; data: { link: string } };
export type PushResult = "ok" | "gone" | "error";
export interface PushTransport { send(msgs: PushMsg[]): Promise<PushResult[]> }

export class ExpoPush implements PushTransport {
  async send(msgs: PushMsg[]): Promise<PushResult[]> {
    const out: PushResult[] = [];
    // Expo bir istekte en fazla 100 bildirim kabul eder.
    for (let i = 0; i < msgs.length; i += 100) {
      const part = msgs.slice(i, i + 100);
      try {
        const res = await fetch(EXPO_PUSH, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(part),
          signal: AbortSignal.timeout(8000),
        });
        const json = (await res.json().catch(() => ({}))) as { data?: { status?: string; details?: { error?: string } }[] };
        const tickets = res.ok ? json.data ?? [] : [];
        out.push(...part.map((_, j): PushResult => tickets[j]?.status === "ok" ? "ok" : tickets[j]?.details?.error === "DeviceNotRegistered" ? "gone" : "error"));
      } catch {
        out.push(...part.map((): PushResult => "error"));
      }
    }
    return out;
  }
}

// Testlerde: gönderilenler bellekte tutulur; "gone" kümesindeki adresler silinmiş cihaz gibi davranır.
export class MemoryPush implements PushTransport {
  sent: PushMsg[] = [];
  gone = new Set<string>();
  async send(msgs: PushMsg[]) {
    this.sent.push(...msgs);
    return msgs.map((m): PushResult => (this.gone.has(m.to) ? "gone" : "ok"));
  }
  last(token: string) { return [...this.sent].reverse().find((m) => m.to === token); }
}

let transport: PushTransport = new ExpoPush();
export const setPushTransport = (t: PushTransport) => { transport = t; };
export const pushTransport = () => transport;

// Verilen cihazlara aynı bildirimi gönderir; silinmiş cihazların adresi kaldırılır.
export async function deliver(db: Pool | Client, tokens: string[], title: string, body: string, link = "") {
  if (!tokens.length) return { devices: 0, delivered: 0, failed: 0 };
  const results = await transport.send(tokens.map((to) => ({ to, title, body: body.slice(0, 180), sound: "default" as const, data: { link } })));
  const ok = tokens.filter((_, i) => results[i] === "ok");
  const gone = tokens.filter((_, i) => results[i] === "gone");
  if (ok.length) await db.query("UPDATE push_tokens SET last_sent_at = now() WHERE token = ANY($1::text[])", [ok]);
  if (gone.length) await db.query("DELETE FROM push_tokens WHERE token = ANY($1::text[])", [gone]);
  return { devices: tokens.length, delivered: ok.length, failed: tokens.length - ok.length };
}

// Tek üyeye bildirim (yeni teklif, mesaj, alarm…). Üye o türü kapattıysa gitmez.
export async function sendPush(db: Pool | Client, userId: string, body: string, link = "", kind?: PushKind) {
  const { rows } = await db.query<{ token: string; push_prefs: PushPrefs }>(
    "SELECT t.token, u.push_prefs FROM push_tokens t JOIN users u ON u.id = t.user_id WHERE t.user_id = $1", [userId]);
  if (!rows.length || (kind && !wantsPush(rows[0]!.push_prefs, kind))) return;
  await deliver(db, rows.map((r) => r.token), "almakisterim", body, link);
}
