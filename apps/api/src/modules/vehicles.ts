import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { BODIES, CAR_BRANDS, FUELS, GEARS, matchBrand, matchModel, MAX_VEHICLES, MOTO_BRANDS, VEHICLE_SUBS } from "../data/vehicles.js";
import { HttpError } from "../lib/util.js";

export type VehicleAttrs = {
  araclar: { marka: string; model: string | null }[];
  yil_min?: number; yil_max?: number; km_max?: number;
  yakit?: string[]; vites?: string[]; kasa?: string[]; hasarsiz?: boolean;
};

const thisYear = () => new Date().getFullYear() + 1;
const Year = z.number().int().min(1950).max(2100);

const RawVehicle = z.object({
  araclar: z.array(z.object({ marka: z.string().max(40), model: z.string().max(40).nullable().optional() })).max(MAX_VEHICLES).default([]),
  yil_min: Year.optional(), yil_max: Year.optional(),
  km_max: z.number().int().min(0).max(2_000_000).optional(),
  yakit: z.array(z.enum(FUELS)).max(FUELS.length).optional(),
  vites: z.array(z.enum(GEARS)).max(GEARS.length).optional(),
  kasa: z.array(z.enum(BODIES)).max(BODIES.length).optional(),
  hasarsiz: z.boolean().optional(),
}).strip();

export const isVehicleSub = (sub: string) => sub in VEHICLE_SUBS;

// Talep verilirken: marka/model listede olmalı, yıl aralığı mantıklı olmalı; tekrarlar ve boş seçimler atılır.
export function parseVehicleAttrs(sub: string, raw: unknown): VehicleAttrs {
  const v = RawVehicle.parse(raw ?? {});
  const seen = new Set<string>();
  const araclar: VehicleAttrs["araclar"] = [];
  for (const a of v.araclar) {
    const marka = matchBrand(sub, a.marka);
    if (!marka) throw new HttpError(400, "marka_gecersiz", `"${a.marka}" markasını tanımıyoruz. Listeden seçin.`);
    const model = a.model ? matchModel(sub, marka, a.model) : null;
    if (a.model && !model) throw new HttpError(400, "model_gecersiz", `${marka} için "${a.model}" modelini tanımıyoruz. Listeden seçin.`);
    const key = `${marka}|${model ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    araclar.push({ marka, model });
  }
  // Markanın tamamı seçildiyse aynı markanın tek tek modelleri gereksizdir.
  const whole = new Set(araclar.filter((a) => !a.model).map((a) => a.marka));
  const out: VehicleAttrs = { araclar: araclar.filter((a) => !a.model || !whole.has(a.marka)) };
  if (v.yil_min !== undefined && v.yil_max !== undefined && v.yil_min > v.yil_max) throw new HttpError(400, "yil_gecersiz", "En eski model yılı, en yeni model yılından büyük olamaz.");
  if (v.yil_max !== undefined && v.yil_max > thisYear()) throw new HttpError(400, "yil_gecersiz", "Model yılı ileri bir tarih olamaz.");
  for (const k of ["yil_min", "yil_max", "km_max", "hasarsiz"] as const) if (v[k] !== undefined) (out as Record<string, unknown>)[k] = v[k];
  for (const k of ["yakit", "vites", "kasa"] as const) if (v[k]?.length) out[k] = [...new Set(v[k])];
  return out;
}

// Yapay zekâ veya kural tabanlı taslaktan gelen değerleri temizler; tanınmayanları sessizce atar.
export function cleanVehicleDraft(sub: string, raw: Record<string, unknown>): VehicleAttrs {
  const list = Array.isArray(raw.araclar) ? raw.araclar as { marka?: string; model?: string | null }[] : [];
  const araclar = list.flatMap((a) => {
    const marka = a?.marka ? matchBrand(sub, a.marka) : null;
    return marka ? [{ marka, model: matchModel(sub, marka, a.model) }] : [];
  }).slice(0, MAX_VEHICLES);
  const pick = <T extends string>(arr: unknown, allowed: readonly T[]) => (Array.isArray(arr) ? arr.filter((x): x is T => allowed.includes(x as T)) : []);
  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? Math.round(x) : undefined);
  try {
    return parseVehicleAttrs(sub, {
      araclar, yil_min: num(raw.yil_min), yil_max: num(raw.yil_max), km_max: num(raw.km_max),
      yakit: pick(raw.yakit, FUELS), vites: pick(raw.vites, GEARS), kasa: pick(raw.kasa, BODIES),
      hasarsiz: raw.hasarsiz === true ? true : undefined,
    });
  } catch {
    return { araclar };
  }
}

// Virgülle ayrılmış seçim listesi ("Dizel,Hibrit"): her değer izin verilenlerden olmalı.
const multi = <T extends string>(allowed: readonly T[]) => z.string().max(200).optional().refine(
  (v) => !v || v.split(",").every((x) => allowed.includes(x as T)), "Listeden seçin.");

// Satıcının elindeki araca (ya da araçlarına) uyan talepler:
// ?arac_marka=BMW&arac_model=3 Serisi (tek araç) veya ?araclar=BMW:3 Serisi,Audi:,Fiat:Egea (birden fazla; model boşsa markanın tümü)
// &arac_yil=2019&arac_km=80000&arac_yakit=Dizel,Benzin&arac_vites=Otomatik
// Alıcı bir alanı boş bıraktıysa ("farketmez") o alan her araca uyar.
export const VehicleQuery = z.object({
  arac_marka: z.string().max(40).optional(), arac_model: z.string().max(40).optional(),
  araclar: z.string().max(600).optional(),
  arac_yil: z.coerce.number().int().min(1950).max(2100).optional(),
  arac_km: z.coerce.number().int().min(0).max(5_000_000).optional(),
  arac_yakit: multi(FUELS), arac_vites: multi(GEARS), arac_kasa: multi(BODIES),
});

// "BMW:3 Serisi,Audi:" → [{marka: BMW, model: 3 Serisi}, {marka: Audi, model: null}] (tanınan yazıma çevrilir, en fazla 20).
export function parseCarList(raw: string | undefined): { marka: string; model: string | null }[] {
  const out: { marka: string; model: string | null }[] = [];
  for (const part of (raw ?? "").split(",").slice(0, 20)) {
    const [m, md] = part.split(":").map((x) => x.trim());
    if (!m) continue;
    const marka = matchBrand("otomobil", m) ?? matchBrand("motosiklet", m) ?? m;
    const model = md ? (matchModel("otomobil", marka, md) ?? matchModel("motosiklet", marka, md) ?? md) : null;
    if (!out.some((x) => x.marka === marka && x.model === model)) out.push({ marka, model });
  }
  return out;
}

export function vehicleFilters(q: z.infer<typeof VehicleQuery>, params: unknown[], where: string[]) {
  const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
  const cars = q.araclar ? parseCarList(q.araclar) : q.arac_marka ? parseCarList(`${q.arac_marka}:${q.arac_model ?? ""}`) : [];
  if (cars.length) {
    // Alıcı markanın tamamını ("model farketmez") veya tam bu modeli istemişse eşleşir; araçlardan biri uyması yeter.
    where.push(`(${cars.map(({ marka, model }) => model
      ? `r.attrs->'araclar' @> ${p(JSON.stringify([{ marka, model: null }]))}::jsonb OR r.attrs->'araclar' @> ${p(JSON.stringify([{ marka, model }]))}::jsonb`
      : `r.attrs->'araclar' @> ${p(JSON.stringify([{ marka }]))}::jsonb`).join(" OR ")})`);
  }
  if (q.arac_yil !== undefined) {
    const y = p(q.arac_yil);
    where.push(`(NOT r.attrs ? 'yil_min' OR (r.attrs->>'yil_min')::int <= ${y}) AND (NOT r.attrs ? 'yil_max' OR (r.attrs->>'yil_max')::int >= ${y})`);
  }
  if (q.arac_km !== undefined) where.push(`(NOT r.attrs ? 'km_max' OR (r.attrs->>'km_max')::int >= ${p(q.arac_km)})`);
  for (const [k, v] of [["yakit", q.arac_yakit], ["vites", q.arac_vites], ["kasa", q.arac_kasa]] as const) {
    if (v) where.push(`(NOT r.attrs ? '${k}' OR r.attrs->'${k}' ?| ${p(v.split(","))}::text[])`);
  }
}

export function vehicleRoutes(app: FastifyInstance) {
  app.get("/catalog/vehicles", async (_req, reply) => {
    reply.header("cache-control", "public, max-age=3600");
    return { cars: CAR_BRANDS, moto: MOTO_BRANDS, subs: VEHICLE_SUBS, fuels: FUELS, gears: GEARS, bodies: BODIES, max: MAX_VEHICLES };
  });
}
