import type { Pool } from "../db.js";
import { HeuristicAi, type AiService, type CategoryRef } from "./ai.js";

// Yapay zekâ ayarları (yönetim → Yapay Zekâ). Her çağrıda tek sorguyla okunur.
export type AiSettings = {
  fixText: boolean; autoDecide: boolean; uncertain: "hold" | "publish"; messages: boolean; names: boolean;
  blogEveryDays: number; blogAutopublish: boolean; dailyLimit: number; autoEmails: boolean;
};
export async function aiSettings(pool: Pool): Promise<AiSettings> {
  const { rows } = await pool.query<{ key: string; value: unknown }>("SELECT key, value FROM settings WHERE key LIKE 'ai\\_%' OR key = 'auto_emails'");
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    fixText: s.ai_fix_text !== false, autoDecide: s.ai_auto_decide !== false, uncertain: s.ai_uncertain === "publish" ? "publish" : "hold",
    messages: s.ai_messages !== false, names: s.ai_names !== false, blogEveryDays: Number(s.ai_blog_every_days ?? 0) || 0,
    blogAutopublish: s.ai_blog_autopublish === true, dailyLimit: Number(s.ai_daily_limit ?? 300) || 0, autoEmails: s.auto_emails !== false,
  };
}

// Yapay zekânın yaptığı her iş kaydedilir; yönetici panelde görür, metin düzeltmelerini geri alabilir.
export async function logAiAction(pool: Pool, a: { kind: string; target: string | number; summary: string; before?: unknown; after?: unknown }) {
  await pool.query("INSERT INTO ai_actions (kind, target_id, summary, before, after) VALUES ($1, $2, $3, $4, $5)",
    [a.kind, String(a.target), a.summary.slice(0, 500), a.before === undefined ? null : JSON.stringify(a.before), a.after === undefined ? null : JSON.stringify(a.after)]);
}

// Günlük çağrı sınırı: sınır dolunca kural tabanlı yedek çalışır, kredi bitmez. Sayaç İstanbul gününe göre.
export class GuardedAi implements AiService {
  private fallback = new HeuristicAi();
  constructor(private pool: Pool, readonly inner: AiService) {}
  errors = () => this.inner.errors?.() ?? [];
  private async allow(): Promise<boolean> {
    const limit = (await aiSettings(this.pool)).dailyLimit;
    if (limit <= 0) return false;
    const r = await this.pool.query(
      `INSERT INTO ai_usage (day, calls) VALUES ((now() AT TIME ZONE 'Europe/Istanbul')::date, 1)
       ON CONFLICT (day) DO UPDATE SET calls = ai_usage.calls + 1 WHERE ai_usage.calls < $1 RETURNING calls`, [limit]);
    return !!r.rowCount;
  }
  private async pick() { return (await this.allow().catch(() => false)) ? this.inner : this.fallback; }
  async draftRequest(text: string, c: CategoryRef[]) { return (await this.pick()).draftRequest(text, c); }
  async moderate(text: string) { return (await this.pick()).moderate(text); }
  async moderateImages(urls: string[]) { return urls.length ? (await this.pick()).moderateImages(urls) : { verdict: "ok" as const, reason: "" }; }
  async reviewListing(i: { title: string; description: string; category: string }) { return (await this.pick()).reviewListing(i); }
  async checkMessage(text: string) { return (await this.pick()).checkMessage(text); }
  async checkName(name: string) { return (await this.pick()).checkName(name); }
  async writeBlog(i: { topic: string; context: string }) {
    if (!(await this.allow())) throw new Error("Bugünkü yapay zekâ kullanım sınırı doldu. Yarın tekrar deneyin ya da sınırı Yapay Zekâ ayarlarından artırın.");
    return this.inner.writeBlog(i);
  }
}
