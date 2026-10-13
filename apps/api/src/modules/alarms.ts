import type { Deps } from "../context.js";
import { HttpError } from "../lib/util.js";
import { CITIES } from "../services/ai.js";
import { matchDistrict, matchNeighbourhood } from "../data/locations.js";
import { ListQuery, requestMatches } from "./requests.js";
import { VehicleQuery } from "./vehicles.js";

// Talep alarmı = kaydedilmiş arama. Süzgeçler talep listesindekilerle aynı adları taşır (city, bmin, a_imar, arac_marka…).
const KEYS = ["q", "city", "district", "neighbourhood", "bmin", "bmax", "cond", "urgent", "buyer",
  "arac_marka", "arac_model", "arac_yil", "arac_km", "arac_yakit", "arac_vites", "arac_kasa"];

export type AlarmRow = { id: number; user_id: string; category_id: string; is_top: boolean; filters: Record<string, string> };
export const ALARM_SELECT = `SELECT a.id, a.user_id, a.category_id, (c.parent_id IS NULL) AS is_top, a.filters
  FROM alarms a JOIN categories c ON c.id = a.category_id`;

// Alarmın talep listesi sorgusu: kategori üst kategoriyse top, alt kategoriyse sub olarak eklenir.
export const alarmQuery = (a: AlarmRow) => ({ ...a.filters, [a.is_top ? "top" : "sub"]: a.category_id });

// Gelen süzgeçleri temizler ve doğrular: bilinmeyen alan atılır, boşlar silinir, il/ilçe/mahalle listeden olmalı.
export function cleanAlarmFilters(input: Record<string, string | number>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, raw] of Object.entries(input)) {
    const v = String(raw).trim();
    if (!v || v === "Farketmez") continue;
    if (KEYS.includes(k) || /^a_[a-z0-9_]{1,20}$/.test(k)) out[k] = v.slice(0, 300);
  }
  if (out.city && !CITIES.includes(out.city)) throw new HttpError(400, "il_gecersiz", "Geçerli bir il seçin.");
  if (!out.city) { delete out.district; delete out.neighbourhood; }
  if (out.district) {
    const d = matchDistrict(out.city!, out.district);
    if (!d) throw new HttpError(400, "ilce_gecersiz", "İlçeyi listeden seçin.");
    out.district = d;
  } else delete out.neighbourhood;
  if (out.neighbourhood) {
    const n = matchNeighbourhood(out.city!, out.district!, out.neighbourhood);
    if (!n) throw new HttpError(400, "mahalle_gecersiz", "Mahalleyi listeden seçin.");
    out.neighbourhood = n;
  }
  if (out.bmin && out.bmax && Number(out.bmin) > Number(out.bmax)) throw new HttpError(400, "butce_gecersiz", "En az bütçe, en fazla bütçeden büyük olamaz.");
  if (!out.arac_marka) delete out.arac_model;
  // Talep listesinin kendi doğrulaması da çalışsın (sayı alanları, yakıt/vites seçenekleri…).
  ListQuery.parse(out);
  VehicleQuery.parse(out);
  return out;
}

// Yeni talebe uyan alarmların sahipleri (talebi verenin kendisi hariç).
export async function alarmOwnersFor(pool: Deps["pool"], requestId: number) {
  const { rows } = await pool.query<AlarmRow>(
    `${ALARM_SELECT} JOIN requests r ON r.id = $1 JOIN categories rc ON rc.id = r.category_id
      WHERE (a.category_id = rc.id OR a.category_id = rc.parent_id) AND a.user_id <> r.buyer_id LIMIT 2000`, [requestId]);
  const users = new Set<string>();
  for (const a of rows) {
    if (users.has(a.user_id)) continue;
    if (await requestMatches(pool, requestId, alarmQuery(a))) users.add(a.user_id);
  }
  return [...users];
}
