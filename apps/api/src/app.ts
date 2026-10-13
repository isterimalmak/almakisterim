import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyServerOptions } from "fastify";
import { z, ZodError } from "zod";

// Doğrulama mesajları Türkçe.
z.config(z.locales.tr());
import { loadUser, SESSION_COOKIE, type Deps } from "./context.js";
import { HttpError } from "./lib/util.js";
import { adminRoutes } from "./modules/admin.js";
import { authRoutes } from "./modules/auth.js";
import { categoryRoutes } from "./modules/categories.js";
import { contactRoutes } from "./modules/contacts.js";
import { adRoutes } from "./modules/ads.js";
import { mediaRoutes } from "./modules/media.js";
import { meRoutes } from "./modules/me.js";
import { messageRoutes } from "./modules/messages.js";
import { offerRoutes } from "./modules/offers.js";
import { requestRoutes } from "./modules/requests.js";
import { vehicleRoutes } from "./modules/vehicles.js";
import { MemoryOutbox } from "./services/notify.js";

// Loglara gizli bilgi düşmesin: çerez ve yetki başlıkları maskelenir; istek gövdeleri hiç loglanmaz.
const REDACT = ["req.headers.cookie", "req.headers.authorization", "req.headers[\"x-job-token\"]", "res.headers[\"set-cookie\"]"];

export async function buildApp(deps: Deps, opts: FastifyServerOptions = {}) {
  const app = Fastify({
    logger: deps.config.NODE_ENV === "test" ? false : { level: deps.config.isProd ? "info" : "debug", redact: REDACT },
    trustProxy: true,
    bodyLimit: 64 * 1024,
    ...opts,
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cookie);
  await app.register(rateLimit, {
    max: 300, timeWindow: "1 minute",
    // Testlerde tüm istekler aynı adresten geldiği için sınır uygulanmaz.
    allowList: () => deps.config.NODE_ENV === "test",
    // Cloudflare arkasında gerçek istemci adresi bu başlıkta gelir.
    keyGenerator: (req) => String(req.headers["cf-connecting-ip"] ?? req.ip),
    errorResponseBuilder: () => ({ statusCode: 429, error: "cok_fazla_istek", message: "Çok fazla istek gönderildi, biraz sonra tekrar deneyin." }),
  });

  app.decorateRequest("user", null);
  app.addHook("onRequest", async (req) => {
    req.user = await loadUser(deps.pool, req.cookies[SESSION_COOKIE]);
  });

  app.setErrorHandler((err: Error, req, reply) => {
    if (err instanceof HttpError) return reply.code(err.status).send({ error: err.code, message: err.message });
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: "gecersiz_veri", message: err.issues[0]?.message ?? "Gönderilen bilgiler geçersiz.", issues: err.issues.map((i) => ({ path: i.path, message: i.message })) });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status < 500) return reply.code(status).send({ error: "istek_hatasi", message: err.message });
    req.log.error({ err }, "beklenmeyen hata");
    return reply.code(500).send({ error: "sunucu_hatasi", message: "Bir sorun oluştu, lütfen tekrar deneyin." });
  });

  app.get("/healthz", async () => ({ ok: true }));
  await app.register(async (api) => {
    api.get("/health", async () => {
      await deps.pool.query("SELECT 1");
      return { ok: true };
    });
    authRoutes(api, deps);
    categoryRoutes(api, deps);
    requestRoutes(api, deps);
    offerRoutes(api, deps);
    contactRoutes(api, deps);
    messageRoutes(api, deps);
    mediaRoutes(api, deps);
    adRoutes(api, deps);
    vehicleRoutes(api);
    meRoutes(api, deps);
    adminRoutes(api, deps);
    // Yalnızca otomatik uçtan uca testlerde: gönderilmiş sayılan son mesajı okur. Üretimde hiç kaydedilmez.
    if (deps.config.NODE_ENV === "test" && deps.sms instanceof MemoryOutbox) {
      const outbox = deps.sms;
      api.get("/__test/last-message", async (req) => ({ text: outbox.last(String((req.query as { to?: string }).to ?? ""))?.text ?? null }));
    }
  }, { prefix: "/api" });

  return app;
}
