import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser, type Deps } from "../context.js";
import { HttpError, maskContacts, publicName, idParam } from "../lib/util.js";
import { CITIES, CONDITIONS, type CategoryRef } from "../services/ai.js";
import { listCategories, VISIBLE_CATEGORY_SQL, visibleSubcategory } from "./categories.js";
import { tx } from "../db.js";
import { priceFor, unlockSettings } from "./contacts.js";
import { attachMedia, imageUrls, MediaIds, mediaFor } from "./media.js";
import { notifyAlarmMatches } from "./notifications.js";

const LIST_COLUMNS = `
  r.id, r.title, r.description, r.category_id, c.name AS category_name, p.id AS top_id, p.name AS top_name,
  r.budget_min, r.budget_max, r.city, r.district, r.condition, r.attrs, r.is_urgent, r.is_corporate,
  r.status, r.created_at, r.expires_at, r.buyer_id,
  u.name AS buyer_name, u.is_corporate AS buyer_is_corporate,
  (SELECT count(*)::int FROM offers o WHERE o.request_id = r.id AND o.status <> 'withdrawn') AS offer_count,
  (SELECT m.storage_key FROM media m WHERE m.request_id = r.id AND m.kind = 'image' ORDER BY m.position LIMIT 1) AS cover_key,
  (SELECT count(*)::int FROM media m WHERE m.request_id = r.id) AS media_count`;
const FROM = `FROM requests r JOIN categories c ON c.id = r.category_id JOIN categories p ON p.id = c.parent_id JOIN users u ON u.id = r.buyer_id`;

type Row = Record<string, unknown> & { buyer_id: string; buyer_name: string };
const publicRow = ({ buyer_id: _b, buyer_name, ...r }: Row) => ({ ...r, buyer_name: publicName(buyer_name) });

const ListQuery = z.object({
  top: z.string().optional(), sub: z.string().optional(), q: z.string().max(100).optional(),
  city: z.string().optional(), bmin: z.coerce.number().int().optional(), bmax: z.coerce.number().int().optional(),
  cond: z.string().optional(), urgent: z.enum(["1"]).optional(), no_offers: z.enum(["1"]).optional(),
  buyer: z.enum(["bireysel", "kurumsal"]).optional(),
  sort: z.enum(["new", "old", "budget_desc", "budget_asc", "few_offers", "ending"]).default("new"),
  page: z.coerce.number().int().min(1).max(500).default(1), per: z.coerce.number().int().min(1).max(50).default(20),
}).passthrough();

const SORTS: Record<string, string> = {
  new: "r.created_at DESC", old: "r.created_at ASC", budget_desc: "r.budget_max DESC", budget_asc: "r.budget_max ASC",
  few_offers: "offer_count ASC, r.created_at DESC", ending: "r.expires_at ASC",
};

const CreateBody = z.object({
  category_id: z.string(),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(4000).default(""),
  budget_min: z.number().int().min(0).nullable().optional(),
  budget_max: z.number().int().min(1).max(2_000_000_000),
  city: z.string().refine((c) => CITIES.includes(c), "Geçerli bir il seçin."),
  district: z.string().trim().max(60).default(""),
  condition: z.enum(CONDITIONS),
  attrs: z.record(z.string().max(30), z.union([z.string().max(60), z.number()])).default({}),
  is_urgent: z.boolean().default(false),
  is_corporate: z.boolean().default(false),
  days: z.union([z.literal(7), z.literal(14), z.literal(30)]).default(14),
  media_ids: MediaIds,
  // Numaranın ücret ödeyen satıcılarla paylaşılması zorunludur; alıcı bunu açıkça onaylar.
  contact_consent: z.literal(true, { error: "Talep vermek için numaranızın satıcılarla paylaşılmasını onaylamalısınız." }),
});

export function requestRoutes(app: FastifyInstance, deps: Deps) {
  const { pool, ai, storage } = deps;
  // Listede ilk fotoğraf kapak olarak gösterilir.
  const pub = (row: Row) => {
    const { cover_key, ...r } = publicRow(row) as Record<string, unknown>;
    return { ...r, cover_url: cover_key ? storage.publicUrl(String(cover_key)) : null };
  };

  app.get("/requests", async (req) => {
    const q = ListQuery.parse(req.query);
    const where = ["r.status = 'active'", "r.expires_at > now()", VISIBLE_CATEGORY_SQL];
    const params: unknown[] = [];
    const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.replaceAll("$?", `$${params.length}`)); };
    if (q.top) add("p.id = $?", q.top);
    if (q.sub) add("c.id = $?", q.sub);
    if (q.q) {
      if (/^\d{7,}$/.test(q.q.trim())) add("r.id = $?", Number(q.q.trim()));
      else add("(r.title ILIKE $? OR r.description ILIKE $?)", `%${q.q.replace(/[%_\\]/g, "\\$&")}%`);
    }
    if (q.city) add("r.city = $?", q.city);
    if (q.bmin !== undefined) add("r.budget_max >= $?", q.bmin);
    if (q.bmax !== undefined) add("r.budget_min <= $?", q.bmax);
    if (q.cond) add("r.condition = ANY($?)", q.cond.split(","));
    if (q.urgent) where.push("r.is_urgent");
    if (q.no_offers) where.push("NOT EXISTS (SELECT 1 FROM offers o WHERE o.request_id = r.id AND o.status <> 'withdrawn')");
    if (q.buyer === "kurumsal") where.push("r.is_corporate");
    if (q.buyer === "bireysel") where.push("NOT r.is_corporate");
    // Kategoriye özel özellik filtreleri: ?a_marka=Apple,Samsung
    for (const [k, v] of Object.entries(q)) {
      if (k.startsWith("a_") && /^a_[a-z0-9]{1,20}$/.test(k) && typeof v === "string") add(`r.attrs->>'${k.slice(2)}' = ANY($?)`, v.split(","));
    }
    const whereSql = where.join(" AND ");
    const total = (await pool.query<{ n: number }>(`SELECT count(*)::int AS n ${FROM} WHERE ${whereSql}`, params)).rows[0]!.n;
    params.push(q.per, (q.page - 1) * q.per);
    const { rows } = await pool.query<Row>(
      `SELECT ${LIST_COLUMNS} ${FROM} WHERE ${whereSql} ORDER BY ${SORTS[q.sort]} LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    return { total, page: q.page, per: q.per, items: rows.map(pub) };
  });

  app.get("/requests/:id", async (req) => {
    const id = idParam(req.params);
    const { rows } = await pool.query<Row & { status: string; category_visible: boolean }>(
      `SELECT ${LIST_COLUMNS}, (${VISIBLE_CATEGORY_SQL}) AS category_visible, r.accepted_offer_id, r.moderation_note ${FROM} WHERE r.id = $1`, [id]);
    const r = rows[0];
    const viewer = req.user;
    const isOwner = !!viewer && viewer.id === r?.buyer_id;
    const isAdmin = viewer?.role === "admin";
    const publicStatus = r && ["active", "closed", "expired"].includes(r.status) && r.category_visible;
    if (!r || (!publicStatus && !isOwner && !isAdmin)) throw new HttpError(404, "bulunamadi", "Talep bulunamadı.");

    // Teklif fiyatlarını yalnızca talep sahibi görür; satıcı yalnızca kendi teklifini görür.
    let offers: unknown[] = [];
    if (isOwner || isAdmin || viewer) {
      const { rows: o } = await pool.query(
        `SELECT o.id, o.price, o.condition, o.delivery, o.warranty, o.note, o.status, o.created_at, o.seller_id,
                s.name AS seller_name, s.is_corporate AS seller_is_corporate,
                (SELECT count(*)::int FROM offers x WHERE x.seller_id = s.id AND x.status = 'accepted') AS seller_sales
           FROM offers o JOIN users s ON s.id = o.seller_id
          WHERE o.request_id = $1 AND o.status <> 'withdrawn' ${isOwner || isAdmin ? "" : "AND o.seller_id = $2"}
          ORDER BY o.price ASC`,
        isOwner || isAdmin ? [id] : [id, viewer!.id]);
      const om = await mediaFor(pool, storage, "offer_id", o.map((x) => Number(x.id)));
      offers = o.map(({ seller_id, seller_name, ...x }) => ({ ...x, mine: seller_id === viewer?.id, seller_name: publicName(String(seller_name)), media: om.get(Number(x.id)) ?? [] }));
    }
    const media = (await mediaFor(pool, storage, "request_id", [id])).get(id) ?? [];
    const fav = viewer ? (await pool.query("SELECT 1 FROM favorites WHERE user_id = $1 AND request_id = $2", [viewer.id, id])).rowCount : 0;
    const { category_visible: _cv, moderation_note, ...rest } = r;

    // Numara: ücret ödeyen satıcı görür. Talep kapanınca yalnızca teklifi kabul edilen satıcıda açık kalır.
    const s = await unlockSettings(pool);
    const unlockRows = (await pool.query<{ seller_id: string; seller_name: string; created_at: string }>(
      `SELECT cu.seller_id, u.name AS seller_name, cu.created_at FROM contact_unlocks cu JOIN users u ON u.id = cu.seller_id
        WHERE cu.request_id = $1 ORDER BY cu.created_at`, [id])).rows;
    const mineUnlocked = !!viewer && unlockRows.some((u) => u.seller_id === viewer.id);
    const accepted = (offers as { mine: boolean; status: string }[]).some((o) => o.mine && o.status === "accepted");
    const showPhone = mineUnlocked && (r.status === "active" || accepted);
    const phone = showPhone ? (await pool.query<{ phone: string | null }>("SELECT phone FROM users WHERE id = $1", [r.buyer_id])).rows[0]?.phone ?? null : null;
    const contact = {
      price: priceFor(s, String(r.top_id)), limit: s.limit, used: unlockRows.length,
      slots_left: s.limit > 0 ? Math.max(0, s.limit - unlockRows.length) : null,
      unlocked: mineUnlocked, phone,
      // Alıcı, numarasını kimlerin gördüğünü görür.
      viewers: isOwner || isAdmin ? unlockRows.map((u) => ({ seller_name: publicName(u.seller_name), created_at: u.created_at })) : undefined,
    };
    return { request: { ...pub(rest as Row), media, is_owner: isOwner, is_favorite: !!fav, moderation_note: isOwner || isAdmin ? moderation_note : undefined }, offers, contact };
  });

  // Yapay zekâ ile taslak: serbest metinden kategori, bütçe, il ve özellikler çıkarılır.
  app.post("/ai/draft", { config: { rateLimit: { max: 15, timeWindow: "1 minute" } } }, async (req) => {
    const { text } = z.object({ text: z.string().trim().min(3).max(1500) }).parse(req.body);
    const cats = await listCategories(pool, true);
    const tops = new Map(cats.filter((c) => !c.parent_id).map((c) => [c.id, c.name]));
    const refs: CategoryRef[] = cats.filter((c) => c.parent_id).map((c) => ({ id: c.id, name: `${tops.get(c.parent_id!)} › ${c.name}`, parent: c.parent_id! }));
    const masked = maskContacts(text);
    const [draft, moderation] = await Promise.all([ai.draftRequest(masked.text, refs), ai.moderate(masked.text)]);
    return { draft: { ...draft, title: maskContacts(draft.title).text, description: masked.text }, moderation, contacts_masked: masked.masked };
  });

  app.post("/requests", { config: { rateLimit: { max: 10, timeWindow: "1 hour" } } }, async (req, reply) => {
    const user = requireUser(req);
    if (!user.phone) throw new HttpError(409, "telefon_gerekli", "Talep vermek için önce telefon numaranızı doğrulayın.");
    const b = CreateBody.parse(req.body);
    const cat = await visibleSubcategory(pool, b.category_id);
    if (!cat) throw new HttpError(400, "kategori_gecersiz", "Bu kategori şu anda talep kabul etmiyor.");
    const budgetMin = b.budget_min ?? Math.round(b.budget_max * 0.8);
    if (budgetMin > b.budget_max) throw new HttpError(400, "butce_gecersiz", "En az bütçe, en fazla bütçeden büyük olamaz.");
    const title = maskContacts(b.title).text, description = maskContacts(b.description).text;
    const [textMod, imgMod] = await Promise.all([ai.moderate(`${title}\n${description}`), imageUrls(pool, storage, user.id, b.media_ids).then((u) => ai.moderateImages(u))]);
    const mod = textMod.verdict !== "ok" ? textMod : imgMod;
    const status = mod.verdict === "ok" ? "active" : "pending_review";
    const id = await tx(pool, async (c) => {
      const { rows } = await c.query<{ id: number }>(
        `INSERT INTO requests (buyer_id, category_id, title, description, budget_min, budget_max, city, district, condition, attrs,
                               is_urgent, is_corporate, status, moderation_note, expires_at, contact_consent_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, now() + make_interval(days => $15), now()) RETURNING id`,
        [user.id, b.category_id, title, description, budgetMin, b.budget_max, b.city, b.district, b.condition, b.attrs,
          b.is_urgent, b.is_corporate || user.is_corporate, status, mod.verdict === "ok" ? null : mod.reason, b.days]);
      await attachMedia(c, user.id, b.media_ids, { request_id: rows[0]!.id });
      return rows[0]!.id;
    });
    if (status === "active") void notifyAlarmMatches(deps, id).catch((e) => req.log.warn({ err: (e as Error).message }, "alarm bildirimi başarısız"));
    reply.code(201);
    return { id, status, moderation: mod.verdict === "ok" ? null : { reason: mod.reason } };
  });

  app.post("/requests/:id/close", async (req) => {
    const user = requireUser(req);
    const id = idParam(req.params);
    const r = await pool.query("UPDATE requests SET status = 'closed' WHERE id = $1 AND buyer_id = $2 AND status IN ('active','pending_review') RETURNING id", [id, user.id]);
    if (!r.rowCount) throw new HttpError(404, "bulunamadi", "Kapatılabilecek talep bulunamadı.");
    return { ok: true };
  });

  app.post("/requests/:id/report", { config: { rateLimit: { max: 10, timeWindow: "1 hour" } } }, async (req) => {
    const id = idParam(req.params);
    const { reason } = z.object({ reason: z.string().trim().min(3).max(300) }).parse(req.body);
    const exists = await pool.query("SELECT 1 FROM requests WHERE id = $1", [id]);
    if (!exists.rowCount) throw new HttpError(404, "bulunamadi", "Talep bulunamadı.");
    await pool.query("INSERT INTO reports (request_id, user_id, reason) VALUES ($1, $2, $3)", [id, req.user?.id ?? null, reason]);
    return { ok: true };
  });
}
