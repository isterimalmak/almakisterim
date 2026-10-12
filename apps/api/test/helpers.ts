import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createPool, type Pool } from "../src/db.js";
import { HeuristicAi, type AiService } from "../src/services/ai.js";
import { disabledGoogle, type GoogleAuth } from "../src/services/google.js";
import { MemoryOutbox } from "../src/services/notify.js";
import { MemoryStorage, type MediaStorage } from "../src/services/storage.js";

export type TestCtx = { app: FastifyInstance; pool: Pool; outbox: MemoryOutbox; storage: MediaStorage };

export async function makeApp(over: { ai?: AiService; google?: GoogleAuth; storage?: MediaStorage; env?: Record<string, string> } = {}): Promise<TestCtx> {
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
  const app = await buildApp({ config, pool, ai: over.ai ?? new HeuristicAi(), mailer: outbox, sms: outbox, google: over.google ?? disabledGoogle, storage });
  return { app, pool, outbox, storage };
}

export async function resetData(pool: Pool) {
  await pool.query(`TRUNCATE media, favorites, reports, alarms, credit_ledger, offers, requests, sessions, auth_codes, users RESTART IDENTITY CASCADE`);
  await pool.query(`ALTER TABLE requests ALTER COLUMN id RESTART WITH 1048200`);
  await pool.query(`UPDATE categories SET is_visible = true`);
  await pool.query(`UPDATE settings SET value = '5' WHERE key = 'free_offers_per_month'`);
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
};

export async function createRequest(ctx: TestCtx, cookie: string, over: Record<string, unknown> = {}): Promise<number> {
  const r = await ctx.app.inject({ method: "POST", url: "/api/requests", headers: { cookie }, payload: { ...sampleRequest, ...over } });
  if (r.statusCode !== 201) throw new Error("talep açılamadı: " + r.body);
  return r.json().id;
}
