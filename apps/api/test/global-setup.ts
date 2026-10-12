import pg from "pg";
import { migrate } from "../src/migrate.js";

// Her test çalıştırmasında boş bir test veritabanı kurulur ve tüm migration'lar uygulanır.
export const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgres://postgres@localhost:5432/almakisterim_test";

export default async function setup() {
  const url = new URL(TEST_DB);
  const name = url.pathname.slice(1);
  const admin = new URL(TEST_DB);
  admin.pathname = "/postgres";
  const c = new pg.Client({ connectionString: admin.toString() });
  await c.connect();
  await c.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await c.query(`CREATE DATABASE "${name}"`);
  await c.end();
  await migrate(TEST_DB, () => {});
  process.env.TEST_DATABASE_URL = TEST_DB;
}
