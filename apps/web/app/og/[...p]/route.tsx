import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

import { CITIES } from "@/lib/catalog";
import { budgetTxt, fmt } from "@/lib/format";
import { locative, slugify } from "@/lib/seo";
import { serverApi, siteData } from "@/lib/server-api";

// Paylaşım resimleri (WhatsApp, Facebook, X önizlemesi), 1200×630:
// /og/talep/1048231, /og/kategori/vasita/otomobil, /og/il/istanbul/vasita, /og/blog/yazi-adresi, /og/site.
// Yazılar adresten değil kayıttan gelir; adrese yazı eklenerek sahte resim üretilemez.
export const dynamic = "force-dynamic";

type Card = { badge: string; title: string; sub?: string; big?: string; foot: string };
type Place = { city: string; top: string | null; sub: string | null; count: number };

const SITE: Card = { badge: "ALIM TALEBİ PLATFORMU", title: "Ne almak istediğinizi yazın, satıcılar size ulaşsın", sub: "Araç, emlak, elektronik, eşya ve hizmet alım talepleri", foot: "Talep vermek ücretsiz" };
let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 700 }[]> | null = null;
const loadFonts = () => (fonts ??= Promise.all([
  readFile(join(process.cwd(), "assets/fonts/Inter-Regular.ttf")).then((data) => ({ name: "Inter", data, weight: 400 as const })),
  readFile(join(process.cwd(), "assets/fonts/Inter-Bold.ttf")).then((data) => ({ name: "Inter", data, weight: 700 as const })),
]));

async function categories() {
  return (await siteData())?.categories ?? [];
}

async function card(p: string[]): Promise<Card> {
  const [kind, a, b, c] = p;
  if (kind === "talep" && a) {
    const d = await serverApi<{ request: { title: string; category_name: string; city: string; district?: string; budget_min: number; budget_max: number; status: string } }>(`/requests/${Number(a) || 0}`);
    if (!d) return SITE;
    const r = d.request;
    return { badge: r.status === "active" ? "ALIM TALEBİ" : "KAPANAN TALEP", title: r.title, sub: [r.category_name, [r.district, r.city].filter(Boolean).join(", ")].filter(Boolean).join(" · "), big: `Bütçe: ${budgetTxt(r.budget_min, r.budget_max)}`, foot: "Elinizde varsa alıcıya ulaşın" };
  }
  if (kind === "kategori" && a) {
    const t = (await categories()).find((x) => x.id === a);
    const s = t && b ? t.subs.find((x) => x.id === b) : undefined;
    if (!t) return SITE;
    const n = (s ?? t).active_count;
    return { badge: "ALIM TALEPLERİ", title: `${(s ?? t).name} almak isteyenler`, sub: s ? t.name : undefined, big: n ? `${fmt(n)} açık talep` : undefined, foot: "Satıcılar alıcıya doğrudan ulaşır" };
  }
  if (kind === "il" && a) {
    const city = CITIES.find((x) => slugify(x) === a);
    if (!city) return SITE;
    const cats = await categories();
    const t = b ? cats.find((x) => x.id === b) : undefined;
    const s = t && c ? t.subs.find((x) => x.id === c) : undefined;
    const pl = await serverApi<{ places: Place[] }>("/seo/places");
    const n = pl?.places.find((x) => x.city === city && x.top === (t?.id ?? null) && x.sub === (s?.id ?? null))?.count ?? 0;
    const name = (s ?? t)?.name;
    return { badge: city.toLocaleUpperCase("tr"), title: `${locative(city)} ${name ? `${name} ` : ""}alım talepleri`, big: n ? `${fmt(n)} açık talep` : undefined, foot: "Satıcılar alıcıya doğrudan ulaşır" };
  }
  if (kind === "blog" && a) {
    const post = await serverApi<{ title: string; summary: string }>(`/blog/${encodeURIComponent(a)}`);
    if (!post) return SITE;
    return { badge: "BLOG", title: post.title, sub: post.summary.length > 140 ? post.summary.slice(0, 140).replace(/\s+\S*$/, "") + "…" : post.summary, foot: "almakisterim.com blog" };
  }
  return SITE;
}

export async function GET(_req: Request, { params }: { params: Promise<{ p: string[] }> }) {
  const c = await card((await params).p.map(decodeURIComponent));
  const titleSize = c.title.length > 70 ? 50 : c.title.length > 40 ? 60 : 70;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#FFFFFF", fontFamily: "Inter", padding: "56px 64px", borderTop: "14px solid #F26B1D" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "#13235B", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, fontWeight: 700 }}>ai</div>
          <div style={{ display: "flex", fontSize: 36, fontWeight: 700, color: "#13235B" }}>almakisterim<span style={{ color: "#F26B1D" }}>.com</span></div>
          <div style={{ marginLeft: "auto", display: "flex", background: "#FFF1E8", color: "#D95A10", fontSize: 24, fontWeight: 700, padding: "10px 20px", borderRadius: 999 }}>{c.badge}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center" }}>
          <div style={{ display: "flex", fontSize: titleSize, fontWeight: 700, color: "#101B2D", lineHeight: 1.15, maxHeight: titleSize * 1.15 * 3, overflow: "hidden" }}>{c.title}</div>
          {c.sub && <div style={{ display: "flex", fontSize: 32, color: "#4A5568", marginTop: 18 }}>{c.sub}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {c.big ? <div style={{ display: "flex", fontSize: 44, fontWeight: 700, color: "#F26B1D" }}>{c.big}</div> : <div style={{ display: "flex" }} />}
          <div style={{ display: "flex", fontSize: 26, color: "#1F54C9", fontWeight: 700 }}>{c.foot} ›</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts: await loadFonts(), headers: { "cache-control": "public, max-age=3600, s-maxage=3600" } },
  );
}
