import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createPool } from "./db.js";
import { createAi } from "./services/ai.js";
import { disabledGoogle, GoogleOAuth } from "./services/google.js";
import { createNotifiers } from "./services/notify.js";
import { createStorage } from "./services/storage.js";

const config = loadConfig();
const pool = createPool(config.DATABASE_URL);
const google = config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET ? new GoogleOAuth(config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET) : disabledGoogle;
const app = await buildApp({ config, pool, ai: createAi(config.ANTHROPIC_API_KEY, config.CLAUDE_MODEL), google, storage: createStorage(config), ...createNotifiers(config) });

const close = async () => {
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on("SIGTERM", close);
process.on("SIGINT", close);

await app.listen({ port: config.PORT, host: "0.0.0.0" });
