import type { PhotoSource } from "../src/services/pexels.js";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createPool, type Pool } from "../src/db.js";
import { HeuristicAi, type AiService } from "../src/services/ai.js";
import { disabledGoogle, type GoogleAuth } from "../src/services/google.js";
import { MemoryOutbox } from "../src/services/notify.js";
import { MemoryStorage, type MediaStorage } from "../src/services/storage.js";

export type TestCtx = { app: FastifyInstance; pool: Pool; outbox: MemoryOutbox; storage: MediaStorage };

export async function makeApp(over: { ai?: AiService; google?: GoogleAuth; storage?: MediaStorage; photos?: PhotoSource; env?: Record<string, string> } = {}): Promise<TestCtx> {
  const config = loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://postgres@localhost:5432/almakisterim_test",
    APP_URL: "http://localhost:3000",
    ADMIN_EMAILS: "yonetici@almakisterim.com",
    JOB_TOKEN: "test-job-token-123",
    ...over.env,
  });
  const pool = createPool(config.DATABASE_URL);
  const outbox = new MemoryOutbox();
  const storage = over.storage ?? new MemoryStorage();
  const app = await buildApp({ config, pool, ai: over.ai ?? new HeuristicAi(), mailer: outbox, sms: outbox, google: over.google ?? disabledGoogle, storage, photos: over.photos });
  return { app, pool, outbox, storage };
}

export async function resetData(pool: Pool) {
  await pool.query(`TRUNCATE blog_posts, ai_actions, ai_usage, stock_images, messages, ads, notifications, contact_reports, contact_unlocks, media, favorites, reports, alarms, credit_ledger, offers, requests, sessions, auth_codes, users RESTART IDENTITY CASCADE`);
  await pool.query(`ALTER TABLE requests ALTER COLUMN id RESTART WITH 1048200`);
  await pool.query(`UPDATE categories SET is_visible = true`);
  await pool.query(`UPDATE settings SET value = CASE key WHEN 'free_unlocks_per_month' THEN '5' WHEN 'unlock_price_credits' THEN '1' WHEN 'unlock_price_by_top' THEN '{}' WHEN 'unlock_limit_per_request' THEN '10' WHEN 'max_active_requests_per_user' THEN '5' WHEN 'launch_mode' THEN 'false' WHEN 'phone_required' THEN 'true' WHEN 'home_urgent_box' THEN 'false' WHEN 'photo_required' THEN 'false' WHEN 'ai_fix_text' THEN 'true' WHEN 'ai_auto_decide' THEN 'true' WHEN 'ai_uncertain' THEN '"hold"' WHEN 'ai_messages' THEN 'true' WHEN 'ai_names' THEN 'true' WHEN 'ai_blog_every_days' THEN '0' WHEN 'ai_blog_autopublish' THEN 'false' WHEN 'ai_daily_limit' THEN '300' WHEN 'auto_emails' THEN 'true' WHEN 'browse_min_requests' THEN '1' WHEN 'show_counts_min' THEN '20' WHEN 'unlock_price_tiers' THEN '[{"max_budget": 10000, "credits": 1}, {"max_budget": 100000, "credits": 3}, {"max_budget": null, "credits": 5}]' ELSE value END`);
}

// SMS ile giriş yapar ve oturum çerezini döndürür.
export async function login(ctx: TestCtx, phoneOrEmail: string, name = "Test Kullanıcı"): Promise<string> {
  const channel = phoneOrEmail.includes("@") ? "email" : "sms";
  const r1 = await ctx.app.inject({ method: "POST", url: "/api/auth/code", payload: { channel, target: phoneOrEmail } });
  if (r1.statusCode !== 200) throw new Error("kod istenemedi: " + r1.body);
  const sent = ctx.outbox.sent.at(-1)!;
  const code = sent.text.match(/\d{6}/)![0];
  const r2 = await ctx.app.inject({ method: "POST", url: "/api/auth/verify", payload: { channel, target: phoneOrEmail, code, name } });
  if (r2.statusCode !== 200) throw new Error("doğrulanamadı: " + r2.body);
  const cookie = r2.cookies.find((c) => c.name === "ak_session")!;
  return `ak_session=${cookie.value}`;
}

export const sampleRequest = {
  category_id: "telefon",
  title: "2. el iPhone 13 almak istiyorum",
  description: "128 GB, pil sağlığı en az %85.",
  budget_min: 17000,
  budget_max: 20000,
  city: "İstanbul",
  district: "Kadıköy",
  condition: "İkinci El",
  attrs: { marka: "Apple", hafiza: "128 GB" },
  is_urgent: true,
  contact_consent: true,
};

export async function createRequest(ctx: TestCtx, cookie: string, over: Record<string, unknown> = {}): Promise<number> {
  const r = await ctx.app.inject({ method: "POST", url: "/api/requests", headers: { cookie }, payload: { ...sampleRequest, ...over } });
  if (r.statusCode !== 201) throw new Error("talep açılamadı: " + r.body);
  return r.json().id;
}

// Satıcı önce alıcının numarasını açar (ücretli), sonra teklif verir.
export async function postOffer(ctx: TestCtx, cookie: string, requestId: number, payload: Record<string, unknown>) {
  await ctx.app.inject({ method: "POST", url: `/api/requests/${requestId}/unlock`, headers: { cookie } });
  return ctx.app.inject({ method: "POST", url: `/api/requests/${requestId}/offers`, headers: { cookie }, payload });
}
