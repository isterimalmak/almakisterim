import type { FastifyInstance } from "fastify";
import type { Pool } from "../db.js";
import { z } from "zod";
import { requireAdmin, type Deps } from "../context.js";

// Yönetim → SEO ve Ölçüm: Google Analytics 4 ölçüm kimliği, Search Console ve Bing doğrulama kodları
// (hepsi sayfada herkese görünen değerlerdir, gizli anahtar değildir) ve arama motorlarından gelenlerin verdiği talepler.

export type Tracking = { ga4_id: string; gsc: string; bing: string };
const KEYS = { ga4_id: "seo_ga4_id", gsc: "seo_gsc_verification", bing: "seo_bing_verification" } as const;

export async function tracking(pool: Pool): Promise<Tracking> {
  const { rows } = await pool.query<{ key: string; value: unknown }>("SELECT key, value FROM settings WHERE key = ANY($1)", [Object.values(KEYS)]);
  const s = Object.fromEntries(rows.map((r) => [r.key, typeof r.value === "string" ? r.value : ""]));
  return { ga4_id: s[KEYS.ga4_id] ?? "", gsc: s[KEYS.gsc] ?? "", bing: s[KEYS.bing] ?? "" };
}

// Gelinen site adından arama motoru: "www.google.com.tr" → Google. Arama motoru değilse null.
const ENGINES: [RegExp, string][] = [[/(^|\.)google\./, "Google"], [/googlequicksearchbox|^com\.google/, "Google"], [/(^|\.)bing\.com$/, "Bing"],
  [/(^|\.)yandex\./, "Yandex"], [/(^|\.)yahoo\./, "Yahoo"], [/(^|\.)duckduckgo\.com$/, "DuckDuckGo"], [/(^|\.)ecosia\.org$/, "Ecosia"], [/search\.brave\.com$/, "Brave"]];
export const engineOf = (host: string) => ENGINES.find(([re]) => re.test(host))?.[1] ?? null;
// Yapay zekâ sohbetlerinden gelenler ayrı sayılır.
const AI: [RegExp, string][] = [[/chatgpt\.com$|openai\.com$/, "ChatGPT"], [/perplexity\.ai$/, "Perplexity"], [/gemini\.google\.com$/, "Gemini"], [/copilot\.microsoft\.com$/, "Copilot"], [/claude\.ai$/, "Claude"]];
const aiOf = (host: string) => AI.find(([re]) => re.test(host))?.[1] ?? null;

const Body = z.object({
  ga4_id: z.string().trim().toUpperCase().regex(/^(G-[A-Z0-9]{4,15})?$/, "Ölçüm kimliği G- ile başlamalı (ör. G-AB12CD34EF).").optional(),
  gsc: z.string().trim().regex(/^[A-Za-z0-9_-]{0,100}$/, "Search Console kodunu yalnızca content=\"…\" içindeki değer olarak yapıştırın.").optional(),
  bing: z.string().trim().regex(/^[A-Fa-f0-9]{0,64}$/, "Bing kodunu yalnızca content=\"…\" içindeki değer olarak yapıştırın.").optional(),
});

export function seoAdminRoutes(app: FastifyInstance, deps: Deps) {
  const { pool } = deps;

  app.get("/admin/seo", async (req) => {
    requireAdmin(req);
    const q = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }).parse(req.query);
    // Gizli kategoriler dahil bütün talepler (incelemede olanlar da): ölçülen şey talep verme davranışıdır.
    const { rows } = await pool.query<{ source_ref: string; source_landing: string; top: string; n: number }>(
      `SELECT r.source_ref, r.source_landing, coalesce(p.name, c.name) AS top, count(*)::int AS n
         FROM requests r JOIN categories c ON c.id = r.category_id LEFT JOIN categories p ON p.id = c.parent_id
        WHERE r.created_at > now() - make_interval(days => $1)
        GROUP BY 1, 2, 3`, [q.days]);
    const add = (m: Map<string, number>, k: string, n: number) => m.set(k, (m.get(k) ?? 0) + n);
    const engines = new Map<string, number>(), ais = new Map<string, number>(), landings = new Map<string, number>(), cats = new Map<string, number>(), others = new Map<string, number>();
    let total = 0, organic = 0, direct = 0;
    for (const r of rows) {
      total += r.n;
      // Gemini de google alan adında: önce yapay zekâ sohbetleri ayrılır.
      const a = aiOf(r.source_ref), e = a ? null : engineOf(r.source_ref);
      if (a) add(ais, a, r.n);
      else if (e) { organic += r.n; add(engines, e, r.n); add(landings, r.source_landing || "/", r.n); add(cats, r.top, r.n); }
      else if (!r.source_ref) direct += r.n;
      else add(others, r.source_ref, r.n);
    }
    const top = (m: Map<string, number>, n = 20) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));
    return {
      tracking: await tracking(pool),
      report: { days: q.days, total, organic, direct, engines: top(engines), ai: top(ais), landings: top(landings), categories: top(cats), others: top(others, 10) },
    };
  });

  app.put("/admin/seo", async (req) => {
    requireAdmin(req);
    const b = Body.parse(req.body);
    for (const [k, v] of Object.entries(b)) {
      if (v === undefined) continue;
      await pool.query("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [KEYS[k as keyof Tracking], JSON.stringify(v)]);
    }
    return { tracking: await tracking(pool) };
  });
}
