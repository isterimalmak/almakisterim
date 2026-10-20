import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin, type Deps } from "../context.js";
import type { Pool } from "../db.js";
import { HttpError } from "../lib/util.js";

// Ana sayfa bölümleri: hazır bölümler (talep kutusu, vitrin, son talepler, yan kutular…) ve yöneticinin eklediği
// yazı / afiş / kayan yazı bölümleri tek listede, yöneticinin seçtiği sırayla. Telefonda hepsi bu sırayla alt alta görünür;
// bilgisayarda yan kutular (lansman, nasıl çalışır, güvenli alışveriş) sağ sütunda aynı sırayla durur.

export const BUILTINS = ["hero", "urgent", "cats", "ads_m", "center_ads", "vitrin", "latest", "corp", "launch", "how", "safe"] as const;
export const SIDE = ["launch", "how", "safe"];

const Href = z.string().trim().max(500).regex(/^(https?:\/\/|\/)/, "Bağlantı https:// veya / ile başlamalı.").nullable().default(null);
const Id = z.string().regex(/^[a-z0-9_]{2,40}$/);
const Color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Renk #RRGGBB biçiminde olmalı.");
// Nerede görünsün: her yerde, yalnızca telefonda, yalnızca bilgisayarda.
const Show = z.enum(["all", "mobile", "desktop"]).default("all");
// Hazır bölümlerin değiştirilebilen yazıları (başlık, düğme…); boş bırakılan alan varsayılan yazıyla görünür.
const Texts = z.record(z.string().regex(/^[a-z0-9_]{1,20}$/), z.string().trim().max(400)).default({})
  .refine((t) => Object.keys(t).length <= 20, "En fazla 20 yazı alanı olabilir.");
const Block = z.discriminatedUnion("type", [
  z.object({ type: z.literal("builtin"), id: z.enum(BUILTINS), hidden: z.boolean().default(false), show: Show, texts: Texts }),
  z.object({ type: z.literal("text"), id: Id, hidden: z.boolean().default(false), title: z.string().trim().max(120).default(""),
    text: z.string().trim().max(1000).default(""), cta: z.string().trim().max(40).default(""), href: Href,
    tone: z.enum(["acik", "lacivert", "turuncu", "yesil"]).default("acik"), align: z.enum(["sol", "orta"]).default("orta"), show: Show }),
  z.object({ type: z.literal("marquee"), id: Id, hidden: z.boolean().default(false), text: z.string().trim().min(1, "Kayan yazı boş olamaz.").max(160),
    bg: Color.default("#F26B1D"), fg: Color.default("#FFFFFF"), href: Href, show: Show }),
  z.object({ type: z.literal("banner"), id: Id, hidden: z.boolean().default(false), title: z.string().trim().max(120).default(""),
    ad_ids: z.array(z.number().int()).max(8).default([]), show: Show }),
]);
export type HomeBlock = z.infer<typeof Block>;
const Blocks = z.array(Block).max(40);

// Kayıtlı liste; yoksa eski ayarlardan (sıra, gizlenenler, vitrin/son talepler düğmeleri) kurulur. Eksik hazır bölümler sona eklenir.
export async function homeBlocks(pool: Pool): Promise<HomeBlock[]> {
  const { rows } = await pool.query<{ key: string; value: unknown }>(
    "SELECT key, value FROM settings WHERE key IN ('home_blocks','home_order','home_hidden','home_vitrin','home_latest')");
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  let list: HomeBlock[];
  const parsed = Blocks.safeParse(s.home_blocks);
  if (Array.isArray(s.home_blocks) && parsed.success) list = parsed.data;
  else {
    const order = Array.isArray(s.home_order) ? (s.home_order as string[]) : [];
    const hidden = Array.isArray(s.home_hidden) ? (s.home_hidden as string[]) : [];
    list = order.filter((x): x is (typeof BUILTINS)[number] => (BUILTINS as readonly string[]).includes(x))
      .map((id) => ({ type: "builtin" as const, id, show: "all" as const, texts: {}, hidden: hidden.includes(id) || (id === "vitrin" && s.home_vitrin === false) || (id === "latest" && s.home_latest === false) }));
  }
  for (const id of BUILTINS) if (!list.some((b) => b.type === "builtin" && b.id === id)) {
    list.push({ type: "builtin", id, show: "all", texts: {}, hidden: (id === "vitrin" && s.home_vitrin === false) || (id === "latest" && s.home_latest === false) });
  }
  return list;
}

export function homeBlockRoutes(app: FastifyInstance, deps: Deps) {
  const { pool, storage } = deps;
  app.get("/admin/home-blocks", async (req) => { requireAdmin(req); return { blocks: await homeBlocks(pool) }; });

  app.put("/admin/home-blocks", async (req) => {
    requireAdmin(req);
    const { blocks } = z.object({ blocks: Blocks }).parse(req.body);
    const ids = blocks.map((b) => b.id);
    if (new Set(ids).size !== ids.length) throw new HttpError(400, "tekrar", "Aynı bölüm iki kez eklenemez.");
    const used = blocks.flatMap((b) => (b.type === "banner" ? b.ad_ids : []));
    if (used.length) {
      const ok = (await pool.query<{ id: number }>("SELECT id FROM ads WHERE id = ANY($1::bigint[]) AND placement = 'blok'", [used])).rows.map((r) => Number(r.id));
      if (used.some((x) => !ok.includes(x))) throw new HttpError(400, "gorsel_yok", "Afişteki görsellerden biri bulunamadı. Lütfen yeniden yükleyin.");
    }
    await pool.query("INSERT INTO settings (key, value) VALUES ('home_blocks', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify(blocks)]);
    // Artık hiçbir afişte kullanılmayan görseller silinir.
    const gone = await pool.query<{ storage_key: string }>(
      `DELETE FROM media WHERE id IN (SELECT media_id FROM ads WHERE placement = 'blok' AND NOT (id = ANY($1::bigint[])) AND created_at < now() - interval '1 hour') RETURNING storage_key`, [used]);
    for (const r of gone.rows) await storage.remove(r.storage_key).catch(() => {});
    return { blocks: await homeBlocks(pool) };
  });
}
