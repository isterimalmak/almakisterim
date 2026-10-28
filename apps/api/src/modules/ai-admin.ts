import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin, type Deps } from "../context.js";
import { HttpError, maskContacts } from "../lib/util.js";
import { aiSettings, logAiAction } from "../services/ai-guard.js";
import { notifyAlarmMatches, requestStatusEmail } from "./notifications.js";

// Hazır blog konuları: otomatik blog sırayla bunlardan henüz yazılmamış olanı seçer; yönetici kendi konusunu da yazabilir.
// Her konu bir üst kategoriye bağlıdır (boşsa genel); yazının altında o kategorinin güncel talepleri gösterilir.
const TOPICS: [string, string | null][] = [
  ["İkinci el araba alırken nelere dikkat edilmeli?", "vasita"],
  ["Satılık ev ararken bütçe nasıl belirlenir?", "emlak"],
  ["Kiralık ev ararken sorulması gereken 10 soru", "emlak"],
  ["Arsa alırken imar ve tapu durumu nasıl kontrol edilir?", "emlak"],
  ["İkinci el telefon alırken dolandırıcılıktan korunmanın yolları", "elektronik"],
  ["Alım talebi vermek ilan aramaktan neden daha hızlı?", null],
  ["Satıcılar için: talep alarmı ile müşteriye ilk ulaşan olun", null],
  ["Kapora dolandırıcılığına karşı güvenli alışveriş rehberi", null],
  ["İkinci el beyaz eşya alırken kontrol listesi", "ev"],
  ["Bebek arabası ve oto koltuğu seçerken dikkat edilecekler", "bebek"],
  ["Ustaya iş verirken teklif nasıl karşılaştırılır?", "hizmet"],
  ["Toptan alımda doğru tedarikçiyi bulmanın yolları", "toptan"],
  ["Ekspertiz raporu nasıl okunur? Tramer, boya ve değişen rehberi", "vasita"],
  ["Tapu devri nasıl yapılır? Masraflar ve gerekli belgeler", "emlak"],
  ["İkinci el laptop alırken kontrol edilmesi gerekenler", "elektronik"],
  ["Alım talebi nasıl yazılır? Hızlı teklif almanın 7 yolu", null],
  ["Elektrikli araç almadan önce bilinmesi gerekenler", "vasita"],
  ["Kira sözleşmesinde dikkat edilmesi gereken maddeler", "emlak"],
  ["IMEI kaydı nedir, telefon alırken nasıl kontrol edilir?", "elektronik"],
  ["İkinci el mobilya alırken dikkat edilecekler", "ev"],
  ["Evden eve nakliyat fiyatı nasıl belirlenir?", "hizmet"],
  ["Oto yedek parçada orijinal, muadil ve çıkma farkı", "yedek"],
  ["İkinci el motosiklet alırken kontrol listesi", "vasita"],
  ["Ev alırken kredi mi, peşin mi? Hesaplama rehberi", "emlak"],
  ["Yenilenmiş telefon mu, ikinci el telefon mu?", "elektronik"],
  ["Özel ders öğretmeni seçerken nelere dikkat edilmeli?", "ders"],
  ["İkinci el bisiklet alırken dikkat edilecekler", "spor"],
  ["İkinci el iş makinesi ve jeneratör alırken kontrol listesi", "sanayi"],
  ["Satıcılar için: alıcıya ilk mesajda ne yazmalı?", null],
  ["Kiralık iş yeri ararken nelere dikkat edilmeli?", "emlak"],
  ["İkinci el oyun konsolu alırken nelere bakılmalı?", "elektronik"],
  ["Ticari araç alırken dikkat edilmesi gerekenler", "vasita"],
  ["İkinci el lastik alırken nelere bakılmalı?", "yedek"],
  ["Temizlik firması seçerken sorulacak sorular", "hizmet"],
  ["İkinci el saat alırken orijinallik nasıl anlaşılır?", "moda"],
  ["İkinci el bebek eşyası alırken güvenlik kontrolleri", "bebek"],
  ["Toptan ambalaj alırken fiyat nasıl karşılaştırılır?", "toptan"],
];
export const BLOG_TOPICS = TOPICS.map(([t]) => t);
const TOPIC_TOP = new Map(TOPICS);

// Türkçe başlıktan adres parçası: "Arsa alırken imar…" → "arsa-alirken-imar…"
export function slugify(t: string) {
  const map: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };
  return t.toLocaleLowerCase("tr").replace(/[çğıöşüâîû]/g, (c) => map[c] ?? c).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "yazi";
}

type Post = { id: number; slug: string; title: string; summary: string; body: string; topic: string; status: string; source: string; created_at: string; published_at: string | null };

// Yapay zekâya siteyi tanıtan kısa bağlam: en çok talep gelen kategoriler.
async function blogContext(deps: Deps) {
  const { rows } = await deps.pool.query<{ name: string; n: number }>(
    `SELECT p.name, count(*)::int AS n FROM requests r JOIN categories c ON c.id = r.category_id JOIN categories p ON p.id = c.parent_id
      WHERE r.status = 'active' GROUP BY p.name ORDER BY n DESC LIMIT 6`);
  return `Site: almakisterim.com (Türkiye). Kategoriler: Vasıta, Emlak, Elektronik, Ev & Yaşam, Yedek Parça, Hizmet, Özel Ders, Sanayi, Moda, Anne & Bebek, Spor, Toptan.`
    + (rows.length ? ` Şu an en çok talep gelenler: ${rows.map((r) => r.name).join(", ")}.` : "");
}

async function insertPost(deps: Deps, d: { title: string; summary: string; body: string; topic: string }, publish: boolean, source: "ai" | "manual") {
  const base = slugify(d.title);
  let slug = base;
  for (let i = 2; (await deps.pool.query("SELECT 1 FROM blog_posts WHERE slug = $1", [slug])).rowCount; i++) slug = `${base}-${i}`;
  const { rows } = await deps.pool.query<Post>(
    `INSERT INTO blog_posts (slug, title, summary, body, topic, status, source, published_at) VALUES ($1,$2,$3,$4,$5,$6,$7, CASE WHEN $6 = 'published' THEN now() END) RETURNING *`,
    [slug, d.title, d.summary, maskContacts(d.body).text, d.topic, publish ? "published" : "draft", source]);
  return rows;
}

export async function generateBlog(deps: Deps, topic: string, publish: boolean): Promise<Post> {
  const d = await deps.ai.writeBlog({ topic, context: await blogContext(deps) });
  const rows = await insertPost(deps, { ...d, topic }, publish, "ai");
  await logAiAction(deps.pool, { kind: "blog", target: rows[0]!.id, summary: `Blog yazısı ${publish ? "yayınlandı" : "taslak olarak yazıldı"}: "${d.title}"` });
  return rows[0]!;
}

// Saatlik işten çağrılır: otomatik blog açıksa ve son yazının üzerinden yeterli gün geçtiyse yeni yazı.
export async function autoBlog(deps: Deps) {
  const s = await aiSettings(deps.pool);
  if (s.blogEveryDays <= 0) return null;
  const recent = await deps.pool.query("SELECT 1 FROM blog_posts WHERE source = 'ai' AND created_at > now() - make_interval(days => $1)", [s.blogEveryDays]);
  if (recent.rowCount) return null;
  const used = new Set((await deps.pool.query<{ topic: string }>("SELECT topic FROM blog_posts")).rows.map((r) => r.topic));
  const topic = BLOG_TOPICS.find((t) => !used.has(t));
  if (!topic) return null;
  return generateBlog(deps, topic, s.blogAutopublish);
}

// Yapay zekâ o an çalışmadığı için bekletilen talepler (ör. "Görseller otomatik denetlenemedi") saatlik işte yeniden denetlenir.
// Uygunsa kendiliğinden yayına alınır ve sahibine "yayına çıktı" bildirimi gider; şüpheliyse yöneticide kalır.
export const AI_HOLD_NOTE = "Görseller otomatik denetlenemedi.";
export async function recheckHeld(deps: Deps, limit = 10) {
  const s = await aiSettings(deps.pool);
  if (!s.autoDecide) return { checked: 0, published: 0 };
  const { rows } = await deps.pool.query<{ id: number; title: string; description: string; category: string }>(
    `SELECT r.id, r.title, r.description, c.name AS category FROM requests r JOIN categories c ON c.id = r.category_id
      WHERE r.status = 'pending_review' AND r.moderation_note = $1 AND r.expires_at > now() ORDER BY r.created_at LIMIT $2`, [AI_HOLD_NOTE, limit]);
  let published = 0, checked = 0;
  for (const r of rows) {
    const keys = (await deps.pool.query<{ storage_key: string }>("SELECT storage_key FROM media WHERE request_id = $1 AND kind = 'image'", [r.id])).rows;
    const [img, rev] = await Promise.all([deps.ai.moderateImages(keys.map((k) => deps.storage.publicUrl(k.storage_key))), deps.ai.reviewListing(r)]);
    // Yapay zekâ hâlâ çalışmıyorsa bekleyenlere dokunulmaz; sonraki saatte yeniden denenir.
    if (img.verdict === "review" && img.reason === AI_HOLD_NOTE) break;
    checked++;
    const order = { ok: 0, review: 1, reject: 2 } as const;
    const mod = order[img.verdict] > order[rev.verdict] ? img : rev;
    const status = mod.verdict === "ok" || (mod.verdict === "review" && s.uncertain === "publish") ? "active" : mod.verdict === "reject" ? "rejected" : "pending_review";
    await deps.pool.query("UPDATE requests SET status = $2, moderation_note = $3, ai_checked_at = now() WHERE id = $1", [r.id, status, status === "active" ? null : mod.reason || null]);
    await logAiAction(deps.pool, { kind: "talep_karar", target: r.id, summary: `${status === "active" ? "Yeniden denetlendi, yayına alındı" : status === "rejected" ? "Yeniden denetlendi, reddedildi" : "Yeniden denetlendi, size bırakıldı"}${mod.reason ? `: ${mod.reason}` : ""}` });
    if (status !== "pending_review") await requestStatusEmail(deps, r.id).catch(() => {});
    if (status === "active") { published++; await notifyAlarmMatches(deps, r.id).catch(() => {}); }
  }
  return { checked, published };
}

// Bağlantıyı dene: örnek bir talep cümlesi yapay zekâya doldurtulur; çalışıyorsa yazdığı başlık ve açıklama, çalışmıyorsa nedeni döner.
export async function testAi(deps: Deps): Promise<{ ok: boolean; ms?: number; title?: string; description?: string; error?: string }> {
  const { pool, config } = deps;
  if (!config.ANTHROPIC_API_KEY.replace(/\s+/g, "")) return { ok: false, error: "Yapay zekâ anahtarı girilmemiş. Yönetim → Entegrasyonlar → Yapay zekâ bölümüne anahtarı yazıp kaydedin." };
  const cats = (await pool.query<{ id: string; name: string; parent_id: string }>("SELECT id, name, parent_id FROM categories WHERE parent_id IS NOT NULL")).rows;
  const started = Date.now();
  const d = await deps.ai.draftRequest("kadıköyde 3+1 kiralık ev bakıyorum eşyalı olsun aylık 40 bine kadar verebilirim kombili olsa iyi olur",
    cats.map((c) => ({ id: c.id, name: c.name, parent: c.parent_id })));
  const ms = Date.now() - started;
  if (d.generated) return { ok: true, ms, title: d.title, description: d.description ?? "" };
  const last = deps.ai.errors?.()[0];
  const s = await aiSettings(pool);
  const used = (await pool.query<{ calls: number }>("SELECT calls FROM ai_usage WHERE day = (now() AT TIME ZONE 'Europe/Istanbul')::date")).rows[0]?.calls ?? 0;
  if (s.dailyLimit <= 0 || used >= s.dailyLimit) return { ok: false, ms, error: "Günlük kullanım sınırı dolu ya da 0; yapay zekâ çağrılmadı. Sınırı Yapay Zekâ ayarlarından artırın." };
  const m = last?.message ?? "";
  const why = /HTTP 401|api.key|authentication/i.test(m) ? "Anahtar geçersiz ya da silinmiş. Anthropic panelinden yeni anahtar alıp Entegrasyonlar bölümüne girin."
    : /credit balance|billing|HTTP 402/i.test(m) ? "Anthropic hesabında kredi bitmiş. console.anthropic.com → Billing bölümünden kredi yükleyin."
    : /HTTP 403|permission/i.test(m) ? "Anahtarın bu modele izni yok. Anthropic panelinde anahtarın çalışma alanını (workspace) ve izinlerini kontrol edin."
    : /HTTP 404|not.found/i.test(m) ? "Model bulunamadı; yedek model de çalışmadı. Entegrasyonlardaki model adını boş bırakın."
    : /HTTP 429|rate/i.test(m) ? "Çok fazla istek (hız sınırı). Birkaç dakika sonra tekrar deneyin."
    : /HTTP 5\d\d|overloaded|timeout|timed out/i.test(m) ? "Anthropic şu an yoğun ya da yanıt vermiyor; biraz sonra tekrar deneyin."
    : "Yapay zekâ yanıt vermedi.";
  return { ok: false, ms, error: `${why}${m ? ` (Teknik ayrıntı: ${m})` : ""}` };
}

const Settings = z.object({
  ai_fix_text: z.boolean(), ai_auto_decide: z.boolean(), ai_uncertain: z.enum(["hold", "publish"]), ai_messages: z.boolean(), ai_names: z.boolean(),
  ai_blog_every_days: z.number().int().min(0).max(60), ai_blog_autopublish: z.boolean(), ai_daily_limit: z.number().int().min(0).max(100000), auto_emails: z.boolean(),
}).partial();

export function aiAdminRoutes(app: FastifyInstance, deps: Deps) {
  const { pool, config } = deps;

  app.get("/admin/ai", async (req) => {
    requireAdmin(req);
    const s = await aiSettings(pool);
    const today = (await pool.query<{ calls: number }>("SELECT calls FROM ai_usage WHERE day = (now() AT TIME ZONE 'Europe/Istanbul')::date")).rows[0]?.calls ?? 0;
    const counts = (await pool.query<{ kind: string; n: number }>(
      "SELECT kind, count(*)::int AS n FROM ai_actions WHERE created_at > now() - interval '30 days' GROUP BY kind")).rows;
    const pending = (await pool.query<{ n: number }>("SELECT count(*)::int AS n FROM requests WHERE ai_checked_at IS NULL AND status IN ('active', 'pending_review')")).rows[0]!.n;
    return {
      connected: !!config.ANTHROPIC_API_KEY.replace(/\s+/g, ""),
      settings: { ai_fix_text: s.fixText, ai_auto_decide: s.autoDecide, ai_uncertain: s.uncertain, ai_messages: s.messages, ai_names: s.names,
        ai_blog_every_days: s.blogEveryDays, ai_blog_autopublish: s.blogAutopublish, ai_daily_limit: s.dailyLimit, auto_emails: s.autoEmails },
      usage: { today, limit: s.dailyLimit },
      counts: Object.fromEntries(counts.map((c) => [c.kind, c.n])),
      unchecked_requests: pending,
      topics: BLOG_TOPICS,
      errors: deps.ai.errors?.() ?? [],
    };
  });

  // Bağlantıyı dene: örnek bir talep cümlesi yapay zekâya doldurtulur; çalışıyorsa yazdığı başlık ve açıklama, çalışmıyorsa hatası döner.
  app.post("/admin/ai/test", { config: { rateLimit: { max: 10, timeWindow: "1 hour" } } }, async (req) => {
    requireAdmin(req);
    return testAi(deps);
  });

  app.put("/admin/ai/settings", async (req) => {
    requireAdmin(req);
    const b = Settings.parse(req.body);
    for (const [k, v] of Object.entries(b)) {
      if (v !== undefined) await pool.query("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [k, JSON.stringify(v)]);
    }
    return { ok: true };
  });

  app.get("/admin/ai/actions", async (req) => {
    requireAdmin(req);
    const { kind } = z.object({ kind: z.string().max(30).optional() }).parse(req.query);
    const { rows } = await pool.query(
      `SELECT id, kind, target_id, summary, before, after, undone_at, created_at FROM ai_actions
        WHERE ($1::text IS NULL OR kind = $1) ORDER BY created_at DESC LIMIT 100`, [kind ?? null]);
    return { items: rows };
  });

  // Geri al: yapay zekânın talep metninde yaptığı düzeltme eski haline döner; verdiği karar (yayına alma/reddetme) tersine çevrilir.
  app.post("/admin/ai/actions/:id/undo", async (req) => {
    requireAdmin(req);
    const { id } = z.object({ id: z.coerce.number().int() }).parse(req.params);
    const a = (await pool.query<{ kind: string; target_id: string; before: { title: string; description: string } | null; undone_at: string | null }>(
      "SELECT kind, target_id, before, undone_at FROM ai_actions WHERE id = $1", [id])).rows[0];
    if (!a) throw new HttpError(404, "bulunamadi", "Kayıt bulunamadı.");
    if (a.undone_at) throw new HttpError(409, "zaten_geri_alindi", "Bu işlem zaten geri alındı.");
    if (a.kind === "talep_duzeltme" && a.before) {
      await pool.query("UPDATE requests SET title = $2, description = $3 WHERE id = $1", [Number(a.target_id), a.before.title, a.before.description]);
    } else if (a.kind === "talep_karar") {
      // Reddedilen ya da incelemeye alınan talep yayına alınır; emin olmadan yayına alınan talep incelemeye çekilir.
      await pool.query(
        `UPDATE requests SET status = CASE WHEN status = 'active' THEN 'pending_review' ELSE 'active' END, moderation_note = NULL
          WHERE id = $1 AND status IN ('active', 'pending_review', 'rejected')`, [Number(a.target_id)]);
    } else throw new HttpError(400, "geri_alinamaz", "Bu işlem geri alınamaz.");
    await pool.query("UPDATE ai_actions SET undone_at = now() WHERE id = $1", [id]);
    return { ok: true };
  });

  // Mevcut talepleri tara: yapay zekânın henüz bakmadığı talepler (en fazla 20) denetlenir ve düzeltilir.
  app.post("/admin/ai/scan", { config: { rateLimit: { max: 20, timeWindow: "1 hour" } } }, async (req) => {
    requireAdmin(req);
    const s = await aiSettings(pool);
    const { rows } = await pool.query<{ id: number; title: string; description: string; status: string; category: string }>(
      `SELECT r.id, r.title, r.description, r.status, c.name AS category FROM requests r JOIN categories c ON c.id = r.category_id
        WHERE r.ai_checked_at IS NULL AND r.status IN ('active', 'pending_review') ORDER BY r.created_at DESC LIMIT 20`);
    let fixed = 0, published = 0, held = 0, rejected = 0;
    for (const r of rows) {
      const rev = await deps.ai.reviewListing({ title: r.title, description: r.description, category: r.category });
      const title = s.fixText ? maskContacts(rev.title).text.slice(0, 120) || r.title : r.title;
      const description = s.fixText ? maskContacts(rev.description).text.slice(0, 4000) : r.description;
      let status = r.status;
      if (s.autoDecide) {
        if (rev.verdict === "reject") status = "rejected";
        else if (rev.verdict === "ok" && r.status === "pending_review") status = "active";
        else if (rev.verdict === "review" && r.status === "active" && s.uncertain === "hold") status = "pending_review";
      }
      await pool.query("UPDATE requests SET title = $2, description = $3, status = $4, moderation_note = CASE WHEN $4 = 'active' THEN NULL ELSE $5 END, ai_checked_at = now() WHERE id = $1",
        [r.id, title, description, status, rev.reason || null]);
      if (title !== r.title || description !== r.description) {
        fixed++;
        await logAiAction(pool, { kind: "talep_duzeltme", target: r.id, summary: rev.changes || "Yazım düzeltildi", before: { title: r.title, description: r.description }, after: { title, description } });
      }
      if (status !== r.status) {
        if (status === "active") published++; else if (status === "rejected") rejected++; else held++;
        void requestStatusEmail(deps, r.id).catch(() => {});
        if (status === "active") void notifyAlarmMatches(deps, r.id).catch(() => {});
        await logAiAction(pool, { kind: "talep_karar", target: r.id, summary: `${status === "active" ? "Yayına alındı" : status === "rejected" ? "Reddedildi" : "İncelemeye alındı"}${rev.reason ? `: ${rev.reason}` : ""}` });
      }
    }
    return { checked: rows.length, fixed, published, held, rejected };
  });

  /* ---------------- Blog ---------------- */

  app.get("/admin/blog", async (req) => {
    requireAdmin(req);
    const { rows } = await pool.query<Post>("SELECT * FROM blog_posts ORDER BY created_at DESC LIMIT 200");
    return { items: rows };
  });

  app.post("/admin/blog/generate", { config: { rateLimit: { max: 20, timeWindow: "1 hour" } } }, async (req, reply) => {
    requireAdmin(req);
    const b = z.object({ topic: z.string().trim().min(5, "Konuyu yazın.").max(200), publish: z.boolean().default(false) }).parse(req.body);
    try {
      reply.code(201);
      return await generateBlog(deps, b.topic, b.publish);
    } catch (e) {
      if (e instanceof HttpError || e instanceof z.ZodError) throw e;
      req.log.warn({ err: (e as Error).message }, "blog yazılamadı");
      throw new HttpError(503, "blog_yazilamadi", (e as Error).message.includes("yapay zekâ") ? (e as Error).message : "Yazı şu anda yazılamadı, biraz sonra tekrar deneyin.");
    }
  });

  // Elle yazı: yapay zekâ bağlı olmasa da yönetici kendi yazısını ekleyebilir.
  app.post("/admin/blog", async (req, reply) => {
    requireAdmin(req);
    const b = z.object({ title: z.string().trim().min(5, "Başlık en az 5 harf olmalı.").max(120), summary: z.string().trim().max(300).default(""),
      body: z.string().trim().min(50, "Yazı en az 50 harf olmalı.").max(60000), publish: z.boolean().default(false) }).parse(req.body);
    reply.code(201);
    return (await insertPost(deps, { ...b, topic: b.title }, b.publish, "manual"))[0];
  });

  app.patch("/admin/blog/:id", async (req) => {
    requireAdmin(req);
    const { id } = z.object({ id: z.coerce.number().int() }).parse(req.params);
    const b = z.object({ title: z.string().trim().min(5).max(120).optional(), summary: z.string().trim().max(300).optional(),
      body: z.string().trim().min(50).max(60000).optional(), status: z.enum(["draft", "published"]).optional() }).parse(req.body);
    const { rows } = await pool.query<Post>(
      `UPDATE blog_posts SET title = COALESCE($2, title), summary = COALESCE($3, summary), body = COALESCE($4, body), status = COALESCE($5, status),
              published_at = CASE WHEN $5 = 'published' AND published_at IS NULL THEN now() ELSE published_at END
        WHERE id = $1 RETURNING *`, [id, b.title ?? null, b.summary ?? null, b.body ?? null, b.status ?? null]);
    if (!rows[0]) throw new HttpError(404, "bulunamadi", "Yazı bulunamadı.");
    return rows[0];
  });

  app.delete("/admin/blog/:id", async (req) => {
    requireAdmin(req);
    const { id } = z.object({ id: z.coerce.number().int() }).parse(req.params);
    await pool.query("DELETE FROM blog_posts WHERE id = $1", [id]);
    return { ok: true };
  });

  /* ---------------- Herkese açık blog ---------------- */

  app.get("/blog", async () => {
    const { rows } = await pool.query("SELECT slug, title, summary, published_at FROM blog_posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 100");
    return { items: rows };
  });

  app.get("/blog/:slug", async (req) => {
    const { slug } = z.object({ slug: z.string().max(100) }).parse(req.params);
    const r = (await pool.query<{ topic: string | null }>("SELECT slug, title, summary, body, published_at, topic FROM blog_posts WHERE slug = $1 AND status = 'published'", [slug])).rows[0];
    if (!r) throw new HttpError(404, "bulunamadi", "Yazı bulunamadı.");
    // İlgili kategori (yazının altında o kategorinin talepleri gösterilir).
    const { topic, ...post } = r;
    return { ...post, top: (topic && TOPIC_TOP.get(topic)) ?? null };
  });
}
