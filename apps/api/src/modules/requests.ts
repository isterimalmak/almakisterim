import { codeService } from "./auth.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser, type Deps } from "../context.js";
import { HttpError, maskContacts, publicName, idParam } from "../lib/util.js";
import { CITIES, CONDITIONS, type CategoryRef } from "../services/ai.js";
import { listCategories, VISIBLE_CATEGORY_SQL, visibleSubcategory } from "./categories.js";
import { tx } from "../db.js";
import { priceFor, unlockSettings } from "./contacts.js";
import { attachMedia, imageUrls, MediaIds, mediaFor } from "./media.js";
import { cityOfDistrict, findDistrictInText, findNeighbourhoodInText, LOCATIONS, matchDistrict, matchNeighbourhood } from "../data/locations.js";
import { attrsFor } from "../data/attrs.js";
import { buildTitle, buyerTitle, describeAttrs, fillAttrs } from "../services/draft-fill.js";
import { cleanVehicleDraft, isVehicleSub, parseVehicleAttrs, VehicleQuery, vehicleFilters } from "./vehicles.js";
import { notifyAlarmMatches, requestStatusEmail } from "./notifications.js";
import { aiSettings, logAiAction } from "../services/ai-guard.js";

const LIST_COLUMNS = `
  r.id, r.title, r.description, r.category_id, c.name AS category_name, p.id AS top_id, p.name AS top_name,
  r.budget_min, r.budget_max, r.city, r.district, r.neighbourhood, r.condition, r.attrs, r.is_urgent, r.is_corporate,
  r.status, r.created_at, r.expires_at, r.buyer_id, coalesce(r.featured_until > now(), false) AS is_featured,
  u.name AS buyer_name, u.is_corporate AS buyer_is_corporate,
  (SELECT count(*)::int FROM offers o WHERE o.request_id = r.id AND o.status <> 'withdrawn') AS offer_count,
  (SELECT m.storage_key FROM media m WHERE m.request_id = r.id AND m.kind = 'image' ORDER BY m.position LIMIT 1) AS cover_key,
  (SELECT count(*)::int FROM media m WHERE m.request_id = r.id) AS media_count`;
export const FROM = `FROM requests r JOIN categories c ON c.id = r.category_id JOIN categories p ON p.id = c.parent_id JOIN users u ON u.id = r.buyer_id`;

type Row = Record<string, unknown> & { buyer_id: string; buyer_name: string };
const publicRow = ({ buyer_id: _b, buyer_name, ...r }: Row) => ({ ...r, buyer_name: publicName(buyer_name) });

export const ListQuery = z.object({
  top: z.string().optional(), sub: z.string().optional(), q: z.string().max(100).optional(),
  city: z.string().optional(), district: z.string().max(60).optional(), neighbourhood: z.string().max(80).optional(), bmin: z.coerce.number().int().optional(), bmax: z.coerce.number().int().optional(),
  cond: z.string().optional(), urgent: z.enum(["1"]).optional(), no_offers: z.enum(["1"]).optional(), featured: z.enum(["1"]).optional(),
  buyer: z.enum(["bireysel", "kurumsal"]).optional(),
  // Seçili talepler (ana sayfadaki kayan vitrin): ?ids=1048201,1048205
  ids: z.string().regex(/^\d{1,12}(,\d{1,12}){0,39}$/, "Talep numaraları virgülle ayrılmalı.").optional(),
  sort: z.enum(["new", "old", "budget_desc", "budget_asc", "few_offers", "ending", "vitrin"]).default("new"),
  page: z.coerce.number().int().min(1).max(500).default(1), per: z.coerce.number().int().min(1).max(50).default(20),
}).passthrough();

const SORTS: Record<string, string> = {
  new: "r.created_at DESC", old: "r.created_at ASC", budget_desc: "r.budget_max DESC", budget_asc: "r.budget_max ASC",
  few_offers: "offer_count ASC, r.created_at DESC", ending: "r.expires_at ASC",
  // Ana sayfa vitrini: önce öne çıkarılanlar, sonra fotoğraflı olanlar, sonra en yeniler.
  vitrin: "coalesce(r.featured_until > now(), false) DESC, EXISTS (SELECT 1 FROM media m WHERE m.request_id = r.id AND m.kind = 'image') DESC, r.created_at DESC",
};

const CreateBody = z.object({
  category_id: z.string(),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(4000).default(""),
  budget_min: z.number().int().min(0).nullable().optional(),
  budget_max: z.number().int().min(1).max(2_000_000_000),
  city: z.string().refine((c) => CITIES.includes(c), "Geçerli bir il seçin."),
  district: z.string().trim().max(60).default(""),
  neighbourhood: z.string().trim().max(80).default(""),
  condition: z.enum(CONDITIONS),
  // Araç kategorilerinde ayrıntılı alanlar (birden fazla marka/model, yıl aralığı...) ayrıca doğrulanır.
  attrs: z.record(z.string().max(30), z.unknown()).default({}),
  // Yayın onayı: cep telefonuna gelen 6 haneli kod (Yönetim → Ayarlar → "Talep verirken SMS onayı" açıksa zorunlu).
  phone: z.string().max(30).optional(),
  phone_code: z.string().regex(/^\d{6}$/, "Doğrulama kodu 6 haneli olmalı.").optional(),
  is_urgent: z.boolean().default(false),
  is_corporate: z.boolean().default(false),
  days: z.union([z.literal(7), z.literal(14), z.literal(30)]).default(14),
  media_ids: MediaIds,
  // Birden fazla araç seçildiyse her aracın kendi görselleri: "Marka|Model" → medya kimlikleri (model yoksa "Marka|").
  vehicle_media: z.record(z.string().max(90), MediaIds).optional(),
  // Numaranın ücret ödeyen satıcılarla paylaşılması zorunludur; alıcı bunu açıkça onaylar.
  contact_consent: z.literal(true, { error: "Talep vermek için numaranızın satıcılarla paylaşılmasını onaylamalısınız." }),
});

// Sayı özelliklerinde alıcının değeri satıcınınkiyle nasıl karşılaştırılır (web/lib/catalog.ts'deki alanlarla aynı anahtarlar):
// m2, boy, kisi, yil: alıcının istediği en az değer ≤ satıcınınki; bina_yasi: alıcının en fazla sınırı ≥ satıcınınki; numara: eşit.
export const NUM_MATCH: Record<string, "<=" | ">=" | "="> = { m2: "<=", boy: "<=", kisi: "<=", yil: "<=", bina_yasi: ">=", numara: "=" };

// Talep listesinin süzgeçleri (kategori, il/ilçe/mahalle, bütçe, durum, özellikler, araç…). Talep alarmları da aynı
// süzgeçleri kullanır: alarm, kaydedilmiş bir aramadır.
export function listFilters(raw: Record<string, unknown>) {
  const q = ListQuery.parse(raw);
  const vq = VehicleQuery.parse(raw);
  const where = ["r.status = 'active'", "r.expires_at > now()", VISIBLE_CATEGORY_SQL];
  const params: unknown[] = [];
  const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.replaceAll("$?", `$${params.length}`)); };
  if (q.top) add("p.id = $?", q.top);
  if (q.sub) add("c.id = $?", q.sub);
  if (q.q) {
    if (/^\d{7,}$/.test(q.q.trim())) add("r.id = $?", Number(q.q.trim()));
    else add("(r.title ILIKE $? OR r.description ILIKE $?)", `%${q.q.replace(/[%_\\]/g, "\\$&")}%`);
  }
  // Birden fazla il virgülle ayrılır (alarmda "İzmir,Manisa"); o zaman ilçe/mahalle sorulmaz.
  const cities = q.city ? q.city.split(",").map((x) => x.trim()).filter(Boolean) : [];
  if (cities.length > 1) { add("r.city = ANY($?)", cities); q.district = undefined; q.neighbourhood = undefined; }
  else if (q.city) add("r.city = $?", q.city);
  // İlçe/mahalle: alıcı o ilçeyi seçmişse ya da ilçe "farketmez" demişse (boş) uyar.
  if (q.city && q.district) add("(r.district = '' OR r.district = $?)", matchDistrict(q.city, q.district) ?? q.district);
  if (q.city && q.district && q.neighbourhood) add("(r.neighbourhood = '' OR r.neighbourhood = $?)", q.neighbourhood);
  if (q.bmin !== undefined) add("r.budget_max >= $?", q.bmin);
  if (q.bmax !== undefined) add("r.budget_min <= $?", q.bmax);
  if (q.cond) add("r.condition = ANY($?)", q.cond.split(","));
  if (q.urgent) where.push("r.is_urgent");
  if (q.featured) where.push("r.featured_until > now()");
  if (q.no_offers) where.push("NOT EXISTS (SELECT 1 FROM offers o WHERE o.request_id = r.id AND o.status <> 'withdrawn')");
  if (q.buyer === "kurumsal") where.push("r.is_corporate");
  if (q.buyer === "bireysel") where.push("NOT r.is_corporate");
  if (q.ids) add("r.id = ANY($?::bigint[])", q.ids.split(",").map(Number));
  // Kategoriye özel özellik filtreleri: ?a_imar=Konut,Ticari. Alıcı o özelliği seçmemiş ya da "Farketmez" demişse de uyar.
  for (const [k, v] of Object.entries(q)) {
    if (/^a_[a-z0-9_]{1,20}$/.test(k) && typeof v === "string") {
      const key = k.slice(2);
      // Boş bırakılmış özellik yalnızca kategori seçiliyken "farketmez" sayılır (başka kategorinin talebi karışmasın).
      const open = q.top || q.sub ? `coalesce(r.attrs->>'${key}', '') IN ('', 'Farketmez')` : `r.attrs->>'${key}' = 'Farketmez'`;
      add(`(${open} OR r.attrs->>'${key}' = ANY($?))`, v.split(",").slice(0, 20));
    }
  }
  // Sayı özellikleri: satıcı elindekinin değerini girer (?n_m2=600), alıcının istediğiyle karşılaştırılır.
  // Alıcı o alanı boş bıraktıysa her zaman uyar.
  for (const [k, v] of Object.entries(raw)) {
    const m = /^n_([a-z0-9_]{1,20})$/.exec(k);
    const op = m ? NUM_MATCH[m[1]!] : undefined;
    if (!m || !op) continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 1e9) throw new HttpError(400, "sayi_gecersiz", "Sayı alanına geçerli bir değer yazın.");
    const key = m[1]!, val = `(r.attrs->>'${key}')`;
    add(`(coalesce(${val}, '') !~ '^[0-9]+(\\.[0-9]+)?$' OR ${val}::numeric ${op} $?)`, n);
  }
  vehicleFilters(vq, params, where);
  return { where, params };
}

/** Bu talep, kaydedilmiş aramaya (alarm süzgeçlerine) uyuyor mu? */
export async function requestMatches(pool: Deps["pool"], requestId: number, filters: Record<string, unknown>) {
  const { where, params } = listFilters(filters);
  params.push(requestId);
  const r = await pool.query(`SELECT 1 ${FROM} WHERE ${where.join(" AND ")} AND r.id = $${params.length}`, params);
  return !!r.rowCount;
}

export function requestRoutes(app: FastifyInstance, deps: Deps) {
  const { pool, ai, storage } = deps;
  const codes = codeService(deps);
  // Listede ilk fotoğraf kapak olarak gösterilir.
  const pub = (row: Row) => {
    const { cover_key, ...r } = publicRow(row) as Record<string, unknown>;
    return { ...r, cover_url: cover_key ? storage.publicUrl(String(cover_key)) : null };
  };

  app.get("/requests", async (req) => {
    const q = ListQuery.parse(req.query);
    const { where, params } = listFilters(req.query as Record<string, unknown>);
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
    // Alıcı paylaşımı durdurduysa ya da o satıcıyı şikâyet ettiyse numara gösterilmez.
    const s = await unlockSettings(pool);
    const extra = (await pool.query<{ hidden: boolean }>("SELECT contact_hidden_at IS NOT NULL AS hidden FROM requests WHERE id = $1", [id])).rows[0]!;
    const unlockRows = (await pool.query<{ id: number; seller_id: string; seller_name: string; created_at: string; revoked: boolean; reported: boolean }>(
      `SELECT cu.id, cu.seller_id, u.name AS seller_name, cu.created_at, cu.revoked_at IS NOT NULL AS revoked,
              EXISTS (SELECT 1 FROM contact_reports cr WHERE cr.unlock_id = cu.id AND cr.side = 'buyer') AS reported
         FROM contact_unlocks cu JOIN users u ON u.id = cu.seller_id WHERE cu.request_id = $1 ORDER BY cu.created_at`, [id])).rows;
    const mine = viewer ? unlockRows.find((u) => u.seller_id === viewer.id) : undefined;
    const accepted = (offers as { mine: boolean; status: string }[]).some((o) => o.mine && o.status === "accepted");
    const showPhone = !!mine && !mine.revoked && !extra.hidden && (r.status === "active" || accepted);
    const buyerPhone = (await pool.query<{ phone: string | null }>("SELECT phone FROM users WHERE id = $1", [r.buyer_id])).rows[0]?.phone ?? null;
    const phone = showPhone ? buyerPhone : null;
    const contact = {
      // Telefon eklememiş alıcıda numara yoktur; satıcı ücretsiz açar ve teklif gönderir.
      price: buyerPhone ? priceFor(s, String(r.top_id), Number(r.budget_max)) : 0, limit: s.limit, used: unlockRows.length,
      has_phone: !!buyerPhone,
      slots_left: s.limit > 0 ? Math.max(0, s.limit - unlockRows.length) : null,
      unlocked: !!mine, unlock_id: mine?.id ?? null, phone, hidden: extra.hidden,
      blocked: !!mine && (mine.revoked || extra.hidden),
      // Alıcı, numarasını kimlerin gördüğünü görür ve rahatsız edeni şikâyet edebilir.
      viewers: isOwner || isAdmin ? unlockRows.map((u) => ({ unlock_id: u.id, seller_name: publicName(u.seller_name), created_at: u.created_at, reported: u.reported })) : undefined,
    };
    // Aynı gönderimden çıkan diğer araç talepleri (alıcı birden fazla araç seçtiyse).
    const group = (await pool.query<{ id: number; title: string }>(
      `SELECT x.id, x.title FROM requests x JOIN requests r ON r.group_id = x.group_id WHERE r.id = $1 AND x.id <> $1 AND x.status IN ('active','pending_review') ${isOwner || isAdmin ? "" : "AND x.status = 'active'"} ORDER BY x.id`, [id])).rows;
    return { request: { ...pub(rest as Row), media, is_owner: isOwner, is_favorite: !!fav, moderation_note: isOwner || isAdmin ? moderation_note : undefined, group }, offers, contact };
  });

  // Yapay zekâ ile taslak: serbest metinden kategori, bütçe, il ve özellikler çıkarılır.
  app.post("/ai/draft", { config: { rateLimit: { max: 15, timeWindow: "1 minute" } } }, async (req) => {
    const { text } = z.object({ text: z.string().trim().min(3).max(1500) }).parse(req.body);
    const cats = await listCategories(pool, true);
    const tops = new Map(cats.filter((c) => !c.parent_id).map((c) => [c.id, c.name]));
    // Her alt kategorinin doldurulacak alanları da yapay zekâya verilir (arsada imar/tapu, kiralıkta eşya, telefonda hafıza…).
    const refs: CategoryRef[] = cats.filter((c) => c.parent_id).map((c) => {
      const schema = isVehicleSub(c.id) ? [] : attrsFor(c.parent_id!, c.id);
      return { id: c.id, name: `${tops.get(c.parent_id!)} › ${c.name}`, parent: c.parent_id!, fields: schema.length ? describeAttrs(schema) : undefined };
    });
    const masked = maskContacts(text);
    const [rawDraft, moderation] = await Promise.all([ai.draftRequest(masked.text, refs), ai.moderate(masked.text)]);
    // Listede olmayan (gizli ya da uydurma) kategori kabul edilmez.
    const ref = refs.find((r) => r.id === rawDraft.category_id);
    const sub = ref ? ref.id : null, parent = ref?.parent;
    // Araçta alanlar katalogla eşleştirilir; diğer kategorilerde alanlar seçeneklerle doğrulanır, eksikler metinden tamamlanır.
    const attrs = sub && isVehicleSub(sub) ? cleanVehicleDraft(sub, rawDraft.attrs)
      : sub ? fillAttrs(masked.text, attrsFor(parent, sub), rawDraft.attrs) : {};
    const loc = resolveLocation(masked.text, rawDraft.city, rawDraft.district ?? null, rawDraft.neighbourhood ?? null);
    const description = maskContacts(rawDraft.description?.trim() || masked.text).text.slice(0, 4000);
    // Yapay zekâ yazmadıysa (bağlı değil, sınır doldu ya da hata) başlık cümle kopyalanmadan doldurulan alanlardan kurulur.
    const subName = ref ? ref.name.split(" › ").pop()! : null;
    // Başlık her zaman alım talebi gibi okunur ("… Alım Talebi", bütçe varsa "… TL Bütçeli"); yapay zekâ yazsa da denetlenir.
    const title = rawDraft.generated ? buyerTitle(rawDraft.title, { sub, budgetMax: rawDraft.budget_max })
      : buildTitle({ sub, subName, attrs, ...loc, budgetMax: rawDraft.budget_max }) ?? buyerTitle(rawDraft.title, { sub, budgetMax: rawDraft.budget_max });
    return {
      draft: { ...rawDraft, generated: undefined, category_id: sub, ...loc, attrs, title: maskContacts(title).text.slice(0, 120), description },
      moderation, contacts_masked: masked.masked,
    };
  });

  app.post("/requests", { config: { rateLimit: { max: 10, timeWindow: "1 hour" } } }, async (req, reply) => {
    const user = requireUser(req);
    const b = CreateBody.parse(req.body);
    // İlçe ve mahalle resmî listedeki yazıma çevrilir; satıcı aramasında birebir eşleşsin.
    if (b.district) {
      const d = matchDistrict(b.city, b.district);
      if (!d) throw new HttpError(400, "ilce_gecersiz", `${b.city} için "${b.district}" ilçesini bulamadık. Listeden seçin.`);
      b.district = d;
    }
    if (b.neighbourhood) {
      const m = b.district ? matchNeighbourhood(b.city, b.district, b.neighbourhood) : null;
      if (!m) throw new HttpError(400, "mahalle_gecersiz", "Mahalleyi listeden seçin.");
      b.neighbourhood = m;
    }
    // Sahte taleplerle satıcıları kendine aratmayı önlemek için kişi başı açık talep sınırı.
    const { maxActive, phoneRequired } = await unlockSettings(pool);
    // Talep verirken SMS onayı: kayıtlı numaraya gelen kod girilmeden talep yayınlanmaz.
    const publishSms = !!(await pool.query("SELECT 1 FROM settings WHERE key = 'publish_sms' AND value = 'true'")).rowCount;
    const pubPhone = publishSms ? await codes.publishPhone(user, b.phone) : null;
    if (publishSms && !b.phone_code) throw new HttpError(400, "telefon_onayi_gerekli", "Talebi yayınlamak için cep telefonunuza gelen doğrulama kodunu girin.");
    if (!user.phone && !pubPhone && phoneRequired) throw new HttpError(409, "telefon_gerekli", "Talep vermek için önce telefon numaranızı doğrulayın.");
    // Birden fazla araçla verilip ayrı taleplere bölünen gönderim tek talep sayılır.
    const active = (await pool.query<{ n: number }>(
      "SELECT count(DISTINCT coalesce(group_id::text, id::text))::int AS n FROM requests WHERE buyer_id = $1 AND status IN ('active','pending_review') AND expires_at > now()", [user.id])).rows[0]!.n;
    if (maxActive > 0 && active >= maxActive) throw new HttpError(409, "talep_siniri", `Aynı anda en fazla ${maxActive} açık talebiniz olabilir. Önce eski taleplerinizden birini kapatın.`);
    const cat = await visibleSubcategory(pool, b.category_id);
    if (!cat) throw new HttpError(400, "kategori_gecersiz", "Bu kategori şu anda talep kabul etmiyor.");
    const attrs = isVehicleSub(b.category_id)
      ? parseVehicleAttrs(b.category_id, b.attrs)
      : z.record(z.string().max(30), z.union([z.string().max(60), z.number()])).parse(b.attrs);
    // Markaya bağlı model (telefon, tablet, bilgisayar): seçilen model o markanın olmalı; marka boşsa modelden bulunur.
    if (!isVehicleSub(b.category_id)) for (const a of attrsFor(cat.parent_id, b.category_id)) {
      const m = (attrs as Record<string, unknown>)[a.k];
      if (!a.om || !a.by || typeof m !== "string" || !m || m === "Farketmez") continue;
      const brand = Object.keys(a.om).find((x) => a.om![x]!.includes(m));
      const cur = (attrs as Record<string, unknown>)[a.by];
      if (!brand || (cur && cur !== "Farketmez" && cur !== brand)) throw new HttpError(400, "model_gecersiz", "Seçtiğiniz model bu markaya ait değil; marka ve modeli listeden yeniden seçin.");
      (attrs as Record<string, unknown>)[a.by] = brand;
    }
    // Birden fazla araç seçildiyse her araç ayrı talep olur (satıcı yalnızca kendi aracına uyan talebi görür);
    // her talep o aracın kendi görselleriyle yayınlanır, ortak görseller ilk talebe eklenir.
    const cars = isVehicleSub(b.category_id) ? (attrs as { araclar: { marka: string; model: string | null; paket?: string | null }[] }).araclar : [];
    const units = cars.length > 1
      ? cars.map((car, i) => {
        const own = (car.paket ? b.vehicle_media?.[`${car.marka}|${car.model ?? ""}|${car.paket}`] : undefined) ?? b.vehicle_media?.[`${car.marka}|${car.model ?? ""}`] ?? [];
        return { attrs: { ...attrs, araclar: [car] }, media: own.length || i > 0 ? own : b.media_ids, car };
      })
      : [{ attrs, media: b.media_ids, car: null as { marka: string; model: string | null; paket?: string | null } | null }];
    if (units.length > 1 && new Set(units.flatMap((u) => u.media)).size !== units.reduce((n, u) => n + u.media.length, 0))
      throw new HttpError(400, "medya_gecersiz", "Aynı fotoğraf birden fazla araca eklenemez.");
    if (storage.enabled && (await pool.query("SELECT 1 FROM settings WHERE key = 'photo_required' AND value = 'true'")).rowCount) {
      for (const u of units) {
        const imgs = (await pool.query<{ n: number }>("SELECT count(*)::int AS n FROM media WHERE id = ANY($1::uuid[]) AND owner_id = $2 AND kind = 'image'", [u.media, user.id])).rows[0]!.n;
        if (!imgs) throw new HttpError(400, "fotograf_gerekli", u.car
          ? `${[u.car.marka, u.car.model, u.car.paket].filter(Boolean).join(" ")} için en az bir fotoğraf ekleyin. Her araç ayrı talep olarak yayınlanır.`
          : "Talep vermek için en az bir fotoğraf ekleyin. Kendi fotoğrafınızı yükleyebilir ya da hazır görsellerden seçebilirsiniz.");
      }
    }
    // Talepte tek fiyat girilir; eski istemcilerden gelen en az bütçe yok sayılır.
    const budgetMin = b.budget_max;
    // Kod, bütün kontroller geçtikten sonra harcanır; numarası olmayan üyenin doğruladığı numara hesabına eklenir.
    if (pubPhone) {
      await codes.consumeCode("sms", pubPhone, b.phone_code!);
      if (!user.phone) await pool.query("UPDATE users SET phone = $2 WHERE id = $1 AND phone IS NULL", [user.id, pubPhone]);
    }
    let title = maskContacts(b.title).text, description = maskContacts(b.description).text;
    // Yapay zekâ: denetler ve (açıksa) yazımı düzeltir, başlığı düzgün yazar, iletişim bilgisi/uygunsuz ifadeyi siler.
    const s = await aiSettings(pool);
    const [rev, imgMod] = await Promise.all([
      ai.reviewListing({ title, description, category: cat.name }),
      imageUrls(pool, storage, user.id, units.flatMap((u) => u.media)).then((u) => ai.moderateImages(u)),
    ]);
    const original = { title, description };
    if (s.fixText) {
      title = maskContacts(rev.title).text.slice(0, 120) || title;
      description = maskContacts(rev.description).text.slice(0, 4000);
    }
    const order = { ok: 0, review: 1, reject: 2 } as const;
    const mod = order[imgMod.verdict] > order[rev.verdict] ? imgMod : rev;
    // Otomatik karar kapalıysa her talep yöneticinin onayına düşer; açıksa uygun olan yayına girer, açıkça yasaklı olan reddedilir.
    const status = !s.autoDecide ? "pending_review"
      : mod.verdict === "ok" ? "active" : mod.verdict === "reject" ? "rejected" : s.uncertain === "publish" ? "active" : "pending_review";
    // Bölünen talepte başlık her araç için ayrı kurulur ("2018 ve Sonrası Dizel BMW 3 Serisi").
    const titleOf = (u: (typeof units)[number]) => u.car
      ? (buildTitle({ sub: b.category_id, subName: cat.name, attrs: u.attrs, city: b.city, district: b.district, neighbourhood: b.neighbourhood, budgetMax: b.budget_max }) ?? buyerTitle([u.car.marka, u.car.model, u.car.paket].filter(Boolean).join(" "), { sub: b.category_id, budgetMax: b.budget_max })).slice(0, 120)
      : title;
    const ids = await tx(pool, async (c) => {
      const group = units.length > 1 ? (await c.query<{ g: string }>("SELECT gen_random_uuid() AS g")).rows[0]!.g : null;
      const out: number[] = [];
      for (const u of units) {
        const { rows } = await c.query<{ id: number }>(
          `INSERT INTO requests (buyer_id, category_id, title, description, budget_min, budget_max, city, district, neighbourhood, condition, attrs,
                                 is_urgent, is_corporate, status, moderation_note, expires_at, contact_consent_at, ai_checked_at, group_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, now() + make_interval(days => $16), now(), now(), $17) RETURNING id`,
          [user.id, b.category_id, titleOf(u), description, budgetMin, b.budget_max, b.city, b.district, b.neighbourhood, b.condition, u.attrs,
            b.is_urgent, b.is_corporate || user.is_corporate, status, mod.verdict === "ok" ? null : mod.reason, b.days, group]);
        await attachMedia(c, user.id, u.media, { request_id: rows[0]!.id });
        out.push(rows[0]!.id);
      }
      return out;
    });
    const id = ids[0]!;
    if (title !== original.title || description !== original.description) {
      await logAiAction(pool, { kind: "talep_duzeltme", target: id, summary: rev.changes || "Yazım düzeltildi", before: original, after: { title, description } });
    }
    if (mod.verdict !== "ok") await logAiAction(pool, { kind: "talep_karar", target: id, summary: `${status === "rejected" ? "Reddedildi" : status === "active" ? "Yayına alındı (emin değil)" : "İncelemeye alındı"}: ${mod.reason}` });
    if (status === "active") for (const x of ids) void notifyAlarmMatches(deps, x).catch((e) => req.log.warn({ err: (e as Error).message }, "alarm bildirimi başarısız"));
    void requestStatusEmail(deps, id, { bell: false }).catch(() => {});
    reply.code(201);
    return { id, ids, status, moderation: mod.verdict === "ok" ? null : { reason: mod.reason } };
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

// Konumu doğrular ve tamamlar: yapay zekânın verdiği il/ilçe/mahalle resmî listede yoksa atılır;
// eksik kalanlar metinden bulunur ("Caddebostan'da 2+1" → İstanbul / Kadıköy / Caddebostan).
export function resolveLocation(text: string, aiCity: string | null, aiDistrict: string | null, aiHood: string | null) {
  let city = aiCity && CITIES.includes(aiCity) ? aiCity : null;
  let district: string | null = null;
  if (aiDistrict) {
    if (city) district = matchDistrict(city, aiDistrict);
    else { const u = cityOfDistrict(aiDistrict); if (u) { city = u.city; district = u.district; } }
  }
  if (!district) { const f = findDistrictInText(text, city); if (f) { city = f.city; district = f.district; } }
  let neighbourhood: string | null = null;
  if (aiHood && city && district) neighbourhood = matchNeighbourhood(city, district, aiHood);
  if (!neighbourhood) {
    const h = findNeighbourhoodInText(text, city, district) ?? (aiHood ? findNeighbourhoodInText(aiHood, city, district) : null);
    if (h) { city = h.city; district = h.district; neighbourhood = h.neighbourhood; }
  }
  return { city, district: district ?? "", neighbourhood: neighbourhood ?? "" };
}
