import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR ?? path.resolve(here, "../../../db/migrations");

// db/migrations içindeki sıralı .sql dosyalarını, daha önce çalışmamış olanlardan
// başlayarak tek tek ve her biri kendi işlemi (transaction) içinde çalıştırır.
export async function migrate(connectionString: string, log: (m: string) => void = console.log): Promise<string[]> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    // Aynı anda iki yayın çalışırsa çakışmasın diye kilit.
    await client.query("SELECT pg_advisory_lock(7300125)");
    const done = new Set((await client.query<{ name: string }>("SELECT name FROM schema_migrations")).rows.map((r) => r.name));
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();
    const applied: string[] = [];
    for (const f of files) {
      if (done.has(f)) continue;
      const sql = await readFile(path.join(MIGRATIONS_DIR, f), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [f]);
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw new Error(`${f} çalıştırılamadı: ${(e as Error).message}`);
      }
      applied.push(f);
      log(`uygulandı: ${f}`);
    }
    if (!applied.length) log("yeni değişiklik yok");
    return applied;
  } finally {
    await client.query("SELECT pg_advisory_unlock(7300125)").catch(() => {});
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL tanımlı değil");
    process.exit(1);
  }
  migrate(url).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
