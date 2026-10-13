import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin, requireUser, type Deps } from "../context.js";
import { tx, type Client, type Pool } from "../db.js";
import { HttpError, idParam } from "../lib/util.js";

// Gelir modeli: satıcı, alıcının numarasını görmek için kredi harcar. Numarayı açan satıcı teklif de verebilir.
export type PriceTier = { max_budget: number | null; credits: number };
export type UnlockSettings = { launch: boolean; free: number; price: number; priceByTop: Record<string, number>; tiers: PriceTier[]; limit: number; maxActive: number };

export async function unlockSettings(db: Pool | Client): Promise<UnlockSettings> {
  const { rows } = await db.query<{ key: string; value: unknown }>(
    `SELECT key, value FROM settings WHERE key IN ('free_unlocks_per_month','unlock_price_credits','unlock_price_by_top',
       'unlock_price_tiers','unlock_limit_per_request','max_active_requests_per_user','launch_mode')`);
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    launch: s.launch_mode === true,
    free: Number(s.free_unlocks_per_month ?? 0),
    price: Number(s.unlock_price_credits ?? 1),
    priceByTop: (s.unlock_price_by_top as Record<string, number>) ?? {},
    tiers: (s.unlock_price_tiers as PriceTier[]) ?? [],
    limit: Number(s.unlock_limit_per_request ?? 10),
    maxActive: Number(s.max_active_requests_per_user ?? 5),
  };
}

// Fiyat sırası: lansman dönemi (ücretsiz) > kategoriye özel fiyat > bütçe kademesi > varsayılan fiyat.
export function priceFor(s: UnlockSettings, top: string, budgetMax: number) {
  if (s.launch) return 0;
  if (s.priceByTop[top] !== undefined) return Number(s.priceByTop[top]);
  const tier = [...s.tiers].sort((a, b) => (a.max_budget ?? Infinity) - (b.max_budget ?? Infinity))
    .find((t) => t.max_budget === null || budgetMax <= t.max_budget);
  return tier ? Number(tier.credits) : s.price;
}

// Ayın başından beri (Türkiye saatiyle) kullanılan ücretsiz numara görme hakkı.
export async function freeUnlocksUsed(db: Pool | Client, userId: string) {
  return (await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM contact_unlocks
      WHERE seller_id = $1 AND is_free
        AND created_at >= date_trunc('month', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul'`, [userId])).rows[0]!.n;
}

export async function notify(db: Pool | Client, userId: string, text: string, link = "") {
  await db.query("INSERT INTO notifications (user_id, text, link) VALUES ($1, $2, $3)", [userId, text, link]);
}

const formatTr = (phone: string) => phone.replace(/^90(\d{3})(\d{3})(\d{2})(\d{2})$/, "0$1 $2 $3 $4");

const REASONS = {
  seller: ["ulasilamiyor", "yanlis_numara", "sahte_talep"],
  buyer: ["rahatsiz_etti"],
} as const;
export const REASON_TEXT: Record<string, string> = {
  ulasilamiyor: "Numaraya ulaşılamıyor", yanlis_numara: "Yanlış numara", sahte_talep: "Sahte talep", rahatsiz_etti: "Satıcı rahatsız etti",
};

export function contactRoutes(app: FastifyInstance, deps: Deps) {
  const { pool } = deps;

  app.post("/requests/:id/unlock", { config: { rateLimit: { max: 60, timeWindow: "1 hour" } } }, async (req, reply) => {
    const user = requireUser(req);
    const id = idParam(req.params);
    // Alıcıyı rahatsız eden satıcı bulunabilsin ve ücretsiz haklar çoklu hesapla sömürülmesin.
    if (!user.phone) throw new HttpError(409, "telefon_gerekli", "Numara görmek için önce kendi telefon numaranızı doğrulayın.");
    const out = await tx(pool, async (c) => {
      const r = (await c.query<{ buyer_id: string; title: string; status: string; open: boolean; hidden: boolean; phone: string | null; top_id: string; budget_max: number }>(
        `SELECT r.buyer_id, r.title, r.status, r.expires_at > now() AS open, r.contact_hidden_at IS NOT NULL AS hidden, u.phone,
                cat.parent_id AS top_id, r.budget_max
           FROM requests r JOIN users u ON u.id = r.buyer_id JOIN categories cat ON cat.id = r.category_id
          WHERE r.id = $1 FOR UPDATE OF r`, [id])).rows[0];
      if (!r) throw new HttpError(404, "bulunamadi", "Talep bulunamadı.");
      if (r.buyer_id === user.id) throw new HttpError(400, "kendi_talebi", "Kendi talebinizin numarasını açamazsınız.");
      const prev = (await c.query<{ revoked: boolean }>("SELECT revoked_at IS NOT NULL AS revoked FROM contact_unlocks WHERE request_id = $1 AND seller_id = $2", [id, user.id])).rows[0];
      if (prev) {
        if (prev.revoked || r.hidden) throw new HttpError(403, "numara_gizli", "Alıcı numarasını sizinle paylaşmayı durdurdu.");
        return { phone: r.phone, charged: 0, free: false, already: true };
      }
      if (r.status !== "active" || !r.open) throw new HttpError(409, "talep_kapali", "Bu talep artık yeni satıcı kabul etmiyor.");
      if (r.hidden) throw new HttpError(409, "numara_gizli", "Alıcı numarasını artık paylaşmıyor.");
      if (!r.phone) throw new HttpError(409, "numara_yok", "Bu alıcının doğrulanmış telefon numarası yok.");

      const s = await unlockSettings(c);
      const count = (await c.query<{ n: number }>("SELECT count(*)::int AS n FROM contact_unlocks WHERE request_id = $1", [id])).rows[0]!.n;
      if (s.limit > 0 && count >= s.limit) throw new HttpError(409, "sinir_doldu", `Bu talepte numarayı görebilecek satıcı sayısı (${s.limit}) doldu.`);

      const price = priceFor(s, r.top_id, r.budget_max);
      let free = false, charged = 0;
      if (price === 0) {
        // Lansman dönemi veya ücretsiz kategori: aylık ücretsiz hakkı da harcamaz.
      } else if ((await freeUnlocksUsed(c, user.id)) < s.free) {
        free = true;
      } else {
        const paid = await c.query("UPDATE users SET credits = credits - $2 WHERE id = $1 AND credits >= $2 RETURNING credits", [user.id, price]);
        if (!paid.rowCount) throw new HttpError(402, "kredi_yok", `Numarayı görmek için ${price} kredi gerekiyor. Kredi yükleyin.`);
        charged = price;
      }
      await c.query("INSERT INTO contact_unlocks (request_id, seller_id, credits, is_free) VALUES ($1,$2,$3,$4)", [id, user.id, charged, free]);
      if (charged) await c.query("INSERT INTO credit_ledger (user_id, delta, reason, ref) VALUES ($1, $2, 'numara', $3)", [user.id, -charged, `request:${id}`]);
      // Alıcı, arayan satıcıya şaşırmasın diye site içinde bilgilendirilir.
      await notify(c, r.buyer_id, `Bir satıcı "${r.title}" talebiniz için numaranızı gördü; sizi arayabilir.`, `/talep/${id}`);
      return { phone: r.phone, charged, free, already: false };
    });
    if (!out.already) reply.code(201);
    return { phone: out.phone, charged_credits: out.charged, free: out.free };
  });

  // Alıcı numara paylaşımını durdurur veya yeniden açar (KVKK: rıza geri alınabilir).
  app.post("/requests/:id/contact", async (req) => {
    const user = requireUser(req);
    const id = idParam(req.params);
    const { hidden } = z.object({ hidden: z.boolean() }).parse(req.body);
    const r = await pool.query(
      `UPDATE requests SET contact_hidden_at = CASE WHEN $3 THEN COALESCE(contact_hidden_at, now()) ELSE NULL END
        WHERE id = $1 AND buyer_id = $2 RETURNING id`, [id, user.id, hidden]);
    if (!r.rowCount) throw new HttpError(404, "bulunamadi", "Talep bulunamadı.");
    return { ok: true, hidden };
  });

  // Satıcının numarasını açtığı talepler.
  app.get("/me/unlocks", async (req) => {
    const user = requireUser(req);
    const { rows } = await pool.query<{ id: number; request_id: number; title: string; status: string; open: boolean; hidden: boolean; revoked: boolean;
      phone: string | null; credits: number; is_free: boolean; created_at: string; refunded: boolean; report_status: string | null; accepted: boolean }>(
      `SELECT cu.id, r.id AS request_id, r.title, r.status, r.expires_at > now() AS open, r.contact_hidden_at IS NOT NULL AS hidden,
              cu.revoked_at IS NOT NULL AS revoked, u.phone, cu.credits, cu.is_free, cu.created_at, cu.refunded_at IS NOT NULL AS refunded,
              (SELECT status FROM contact_reports cr WHERE cr.unlock_id = cu.id AND cr.side = 'seller') AS report_status,
              EXISTS (SELECT 1 FROM offers o WHERE o.request_id = r.id AND o.seller_id = cu.seller_id AND o.status = 'accepted') AS accepted
         FROM contact_unlocks cu JOIN requests r ON r.id = cu.request_id JOIN users u ON u.id = r.buyer_id
        WHERE cu.seller_id = $1 ORDER BY cu.created_at DESC LIMIT 300`, [user.id]);
    return {
      items: rows.map(({ phone, hidden, revoked, ...x }) => {
        const visible = !hidden && !revoked && (x.status === "active" || x.accepted);
        return { ...x, phone: visible ? phone : null, phone_note: revoked || hidden ? "Alıcı numarasını paylaşmayı durdurdu" : visible ? null : "Talep kapandı" };
      }),
    };
  });

  // Satıcı: ulaşılamıyor / yanlış numara / sahte talep (7 gün içinde). Alıcı: satıcı rahatsız etti (numara o satıcıdan gizlenir).
  app.post("/unlocks/:id/report", { config: { rateLimit: { max: 20, timeWindow: "1 hour" } } }, async (req, reply) => {
    const user = requireUser(req);
    const unlockId = idParam(req.params);
    const b = z.object({ reason: z.enum(["ulasilamiyor", "yanlis_numara", "sahte_talep", "rahatsiz_etti"]), note: z.string().trim().max(500).default("") }).parse(req.body);
    const u = (await pool.query<{ seller_id: string; buyer_id: string; recent: boolean }>(
      `SELECT cu.seller_id, r.buyer_id, cu.created_at > now() - interval '7 days' AS recent
         FROM contact_unlocks cu JOIN requests r ON r.id = cu.request_id WHERE cu.id = $1`, [unlockId])).rows[0];
    const side = u?.seller_id === user.id ? "seller" : u?.buyer_id === user.id ? "buyer" : null;
    if (!u || !side) throw new HttpError(404, "bulunamadi", "Kayıt bulunamadı.");
    if (!(REASONS[side] as readonly string[]).includes(b.reason)) throw new HttpError(400, "gecersiz_sebep", "Bu bildirim sebebi size uygun değil.");
    if (side === "seller" && !u.recent) throw new HttpError(409, "sure_doldu", "Sorun bildirimi numarayı açtıktan sonraki 7 gün içinde yapılabilir.");
    await tx(pool, async (c) => {
      const ins = await c.query("INSERT INTO contact_reports (unlock_id, reporter_id, side, reason, note) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (unlock_id, side) DO NOTHING RETURNING id",
        [unlockId, user.id, side, b.reason, b.note]);
      if (!ins.rowCount) throw new HttpError(409, "zaten_bildirildi", "Bu kayıt için zaten bildirim yaptınız.");
      if (side === "buyer") await c.query("UPDATE contact_unlocks SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL", [unlockId]);
    });
    reply.code(201);
    return { ok: true };
  });

  // Site içi bildirimler.
  app.get("/me/notifications", async (req) => {
    const user = requireUser(req);
    const { rows } = await pool.query("SELECT id, text, link, read_at, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100", [user.id]);
    return { items: rows };
  });
  app.post("/me/notifications/read", async (req) => {
    const user = requireUser(req);
    await pool.query("UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL", [user.id]);
    return { ok: true };
  });

  /* ---------------- Yönetim ---------------- */

  app.get("/admin/unlocks", async (req) => {
    requireAdmin(req);
    const month = `date_trunc('month', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul'`;
    const sum = (await pool.query<{ today: number; month: number; month_credits: number; month_free: number; refunded_credits: number }>(
      `SELECT count(*) FILTER (WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul')::int AS today,
              count(*) FILTER (WHERE created_at >= ${month})::int AS month,
              COALESCE(sum(credits) FILTER (WHERE created_at >= ${month}), 0)::int AS month_credits,
              count(*) FILTER (WHERE created_at >= ${month} AND is_free)::int AS month_free,
              COALESCE(sum(refund_credits) FILTER (WHERE refunded_at >= ${month}), 0)::int AS refunded_credits
         FROM contact_unlocks`)).rows[0]!;
    const byTop = (await pool.query(
      `SELECT p.id, p.name, count(*)::int AS unlocks, COALESCE(sum(cu.credits), 0)::int AS credits
         FROM contact_unlocks cu JOIN requests r ON r.id = cu.request_id JOIN categories c ON c.id = r.category_id JOIN categories p ON p.id = c.parent_id
        WHERE cu.created_at >= ${month} GROUP BY p.id, p.name ORDER BY credits DESC, unlocks DESC`)).rows;
    return { summary: sum, by_top: byTop };
  });

  app.get("/admin/contact-reports", async (req) => {
    requireAdmin(req);
    const { status } = z.object({ status: z.enum(["open", "all"]).default("open") }).parse(req.query);
    const { rows } = await pool.query<Record<string, unknown> & { reason: string; seller_phone: string | null; buyer_phone: string | null; seller_name: string; buyer_name: string }>(
      `SELECT cr.id, cr.side, cr.reason, cr.note, cr.status, cr.created_at, cu.id AS unlock_id, cu.credits, cu.refunded_at,
              r.id AS request_id, r.title, s.name AS seller_name, s.phone AS seller_phone, b.name AS buyer_name, b.phone AS buyer_phone,
              (SELECT count(*)::int FROM contact_reports x JOIN contact_unlocks y ON y.id = x.unlock_id WHERE x.side = 'buyer' AND y.seller_id = s.id) AS seller_complaints,
              (SELECT count(*)::int FROM contact_reports x JOIN contact_unlocks y ON y.id = x.unlock_id JOIN requests z ON z.id = y.request_id
                WHERE x.side = 'seller' AND z.buyer_id = b.id) AS buyer_complaints
         FROM contact_reports cr JOIN contact_unlocks cu ON cu.id = cr.unlock_id JOIN requests r ON r.id = cu.request_id
         JOIN users s ON s.id = cu.seller_id JOIN users b ON b.id = r.buyer_id
        WHERE ($1 = 'all' OR cr.status = 'open') ORDER BY cr.created_at DESC LIMIT 200`, [status]);
    return { items: rows.map((x) => ({ ...x, reason_text: REASON_TEXT[x.reason], seller_phone: x.seller_phone && formatTr(x.seller_phone), buyer_phone: x.buyer_phone && formatTr(x.buyer_phone), seller_name: x.seller_name || "—", buyer_name: x.buyer_name || "—" })) };
  });

  // refund: satıcının harcadığı kredi geri yüklenir. reject: bildirim yersiz. resolve: alıcı şikâyeti incelendi.
  app.post("/admin/contact-reports/:id/resolve", async (req) => {
    const admin = requireAdmin(req);
    const id = idParam(req.params);
    const { action } = z.object({ action: z.enum(["refund", "reject", "resolve"]) }).parse(req.body);
    return tx(pool, async (c) => {
      const r = (await c.query<{ status: string; side: string; unlock_id: number; seller_id: string; credits: number; refunded: boolean; request_id: number; title: string }>(
        `SELECT cr.status, cr.side, cu.id AS unlock_id, cu.seller_id, cu.credits, cu.refunded_at IS NOT NULL AS refunded, r.id AS request_id, r.title
           FROM contact_reports cr JOIN contact_unlocks cu ON cu.id = cr.unlock_id JOIN requests r ON r.id = cu.request_id
          WHERE cr.id = $1 FOR UPDATE OF cr, cu`, [id])).rows[0];
      if (!r) throw new HttpError(404, "bulunamadi", "Bildirim bulunamadı.");
      if (r.status !== "open") throw new HttpError(409, "kapali", "Bu bildirim zaten sonuçlandırıldı.");
      if (action === "refund" && r.side !== "seller") throw new HttpError(400, "iade_yok", "İade yalnızca satıcı bildirimlerinde yapılır.");
      let refunded = 0;
      if (action === "refund" && !r.refunded) {
        refunded = r.credits;
        await c.query("UPDATE contact_unlocks SET refunded_at = now(), refund_credits = $2 WHERE id = $1", [r.unlock_id, refunded]);
        if (refunded) {
          await c.query("UPDATE users SET credits = credits + $2 WHERE id = $1", [r.seller_id, refunded]);
          await c.query("INSERT INTO credit_ledger (user_id, delta, reason, ref) VALUES ($1, $2, 'numara_iade', $3)", [r.seller_id, refunded, `unlock:${r.unlock_id}`]);
        }
      }
      const status = action === "refund" ? "refunded" : action === "reject" ? "rejected" : "resolved";
      await c.query("UPDATE contact_reports SET status = $2, resolved_at = now(), resolved_by = $3 WHERE id = $1", [id, status, admin.id]);
      if (r.side === "seller") {
        await notify(c, r.seller_id, action === "refund"
          ? `"${r.title}" talebi için bildiriminiz onaylandı${refunded ? `, ${refunded} kredi iade edildi` : ""}.`
          : `"${r.title}" talebi için bildiriminiz incelendi, iade yapılmadı.`, `/talep/${r.request_id}`);
      }
      return { ok: true, status, refunded_credits: refunded };
    });
  });
}
