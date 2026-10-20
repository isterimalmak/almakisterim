import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createPool } from "./db.js";
import { photoSourceFor } from "./modules/stock.js";
import { createAi } from "./services/ai.js";
import { disabledGoogle, GoogleOAuth } from "./services/google.js";
import { Integrations, live } from "./services/integrations.js";
import { createNotifiers } from "./services/notify.js";
import { createStorage } from "./services/storage.js";
import { createPayments } from "./services/payments.js";

const config = loadConfig();
const pool = createPool(config.DATABASE_URL);

// Hizmetler yapılandırmadan kurulur; panelden (Entegrasyonlar) anahtar değişince yeniden kurulur, yeniden yayına gerek kalmaz.
const build = () => ({
  ai: createAi(config.ANTHROPIC_API_KEY, config.CLAUDE_MODEL),
  google: config.GOOGLE_CLIENT_ID.trim() && config.GOOGLE_CLIENT_SECRET.trim() ? new GoogleOAuth(config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET) : disabledGoogle,
  storage: createStorage(config),
  photos: photoSourceFor(config),
  payments: createPayments(config),
  ...createNotifiers(config),
});
let svc = build();
const integrations = new Integrations(pool, config, () => { svc = build(); });
await integrations.refresh(true).catch((e) => console.warn(JSON.stringify({ level: "warn", msg: "panel anahtarları okunamadı", error: String((e as Error).message) })));
integrations.start();

const app = await buildApp({
  config, pool, integrations,
  ai: live(() => svc.ai), google: live(() => svc.google), storage: live(() => svc.storage), photos: live(() => svc.photos), payments: live(() => svc.payments),
  mailer: live(() => svc.mailer), sms: live(() => svc.sms),
});

const close = async () => {
  integrations.stop();
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on("SIGTERM", close);
process.on("SIGINT", close);

await app.listen({ port: config.PORT, host: "0.0.0.0" });
