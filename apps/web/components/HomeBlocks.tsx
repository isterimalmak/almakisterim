"use client";

import Link from "next/link";
import { useSession } from "./Session";
import { useEffect, useState, type ReactNode } from "react";
import { api, type Ad, type RequestItem } from "@/lib/api";
import { MQ_PX, SPEEDS, type HomeBlock } from "@/lib/home";
import { AdGrid } from "./Ads";
import { VitrinTile } from "./RequestTable";

// Yöneticinin ana sayfaya eklediği bölümler: yazı/duyuru, afiş (resim/video) ve kayan yazı bandı.

function Go({ href, className, children, label }: { href: string | null; className: string; children: ReactNode; label?: string }) {
  if (!href) return <div className={className}>{children}</div>;
  return href.startsWith("/")
    ? <Link className={className} href={href} aria-label={label}>{children}</Link>
    : <a className={className} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>{children}</a>;
}

// Kayan vitrin: yöneticinin seçtiği talepler tek satırda sağdan sola akar; üstüne gelince durur.
// Yayından kalkan (süresi dolan, kapanan) talepler kendiliğinden düşer.
function Showcase({ b }: { b: Extract<HomeBlock, { type: "showcase" }> }) {
  const [items, setItems] = useState<RequestItem[] | null>(null);
  const key = b.request_ids.join(",");
  useEffect(() => {
    if (!key) { setItems([]); return; }
    void api<{ items: RequestItem[] }>(`/requests?ids=${key}&per=40`)
      .then((r) => setItems(key.split(",").map((id) => r.items.find((x) => String(x.id) === id)).filter((x): x is RequestItem => !!x)))
      .catch(() => setItems([]));
  }, [key]);
  if (!items?.length) return null;
  // Şerit boşluksuz dönsün diye kartlar en az 8 olacak kadar çoğaltılır, sonra iki kez art arda dizilir.
  const row = Array.from({ length: Math.ceil(8 / items.length) }, () => items).flat();
  const secs = (SPEEDS.find((x) => x[0] === b.speed)?.[2] ?? 5) * row.length;
  return (
    <section className="box hsec sc" aria-label={b.title || "Vitrin"}>
      <div className="box-h"><h2>{b.title || "Vitrin"}</h2></div>
      <div className="sc-wrap"><div className="sc-track" style={{ animationDuration: `${secs}s` }}>
        {[...row, ...row].map((r, i) => <div key={i} className="sc-i" aria-hidden={i >= row.length || undefined}><VitrinTile r={r} /></div>)}
      </div></div>
    </section>
  );
}

// Kategori vitrini: elle eklenenler en başta, sonra kategorinin talepleri (öne çıkan, fotoğraflı, en yeni); çıkarılanlar görünmez.
export async function catVitrinItems(b: Extract<HomeBlock, { type: "catvitrin" }>): Promise<{ items: RequestItem[]; total: number }> {
  const [inc, auto] = await Promise.all([
    b.include_ids.length ? api<{ items: RequestItem[] }>(`/requests?ids=${b.include_ids.join(",")}&per=40`).then((r) => r.items) : Promise.resolve([] as RequestItem[]),
    api<{ items: RequestItem[]; total: number }>(`/requests?top=${encodeURIComponent(b.top)}&sort=vitrin&per=${Math.min(50, b.limit + b.exclude_ids.length + b.include_ids.length)}`),
  ]);
  const pinned = b.include_ids.map((id) => inc.find((x) => x.id === id)).filter((x): x is RequestItem => !!x);
  const seen = new Set(pinned.map((x) => x.id));
  const rest = auto.items.filter((x) => !seen.has(x.id) && !b.exclude_ids.includes(x.id));
  return { items: [...pinned, ...rest].filter((x) => !b.exclude_ids.includes(x.id)).slice(0, b.limit), total: auto.total };
}

function CatVitrin({ b }: { b: Extract<HomeBlock, { type: "catvitrin" }> }) {
  const { count } = useSession();
  const [d, setD] = useState<{ items: RequestItem[]; total: number } | null>(null);
  const key = JSON.stringify([b.top, b.limit, b.include_ids, b.exclude_ids]);
  useEffect(() => { void catVitrinItems(b).then(setD).catch(() => setD({ items: [], total: 0 })); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d?.items.length) return null;
  return (
    <section className="box hsec" style={{ marginBottom: 14 }} aria-label={b.title}>
      <div className="box-h"><h2>{b.title}</h2><Link className="link" href={`/kategori/${b.top}`}>Tümünü gör{count(d.total) !== null && ` (${d.total})`} ›</Link></div>
      <div className="box-b"><div className="vt vt-home">{d.items.map((r) => <VitrinTile key={r.id} r={r} />)}</div></div>
    </section>
  );
}

export function CustomBlock({ b, ads }: { b: Exclude<HomeBlock, { type: "builtin" }>; ads: Ad[] }) {
  if (b.type === "showcase") return <Showcase b={b} />;
  if (b.type === "catvitrin") return <CatVitrin b={b} />;
  if (b.type === "text") {
    if (!b.title && !b.text) return null;
    return (
      <section className={`hb-text tone-${b.tone} al-${b.align}`}>
        {b.title && <h2>{b.title}</h2>}
        {b.text && <p>{b.text}</p>}
        {b.cta && b.href && <Go href={b.href} className="btn btn-lg hb-cta">{b.cta}</Go>}
      </section>
    );
  }
  if (b.type === "marquee") {
    const row = <span>{Array.from({ length: 6 }, (_, i) => <b key={i}>{b.text}<i>•</i></b>)}</span>;
    // Süre yazının uzunluğuna göre: bir satır (6 kopya, harf başına ~10,5 px + ayraç) seçilen hızda kayar.
    const secs = Math.max(10, Math.round((6 * (b.text.length * 10.5 + 66)) / (MQ_PX[b.speed ?? 2] ?? 45)));
    return <Go href={b.href} className="hb-mq" label={b.text}><span className="hb-mq-in" style={{ background: b.bg, color: b.fg }}><span className="hb-mq-track" style={{ animationDuration: `${secs}s` }}>{row}{row}</span></span></Go>;
  }
  // Afiş: tek görsel geniş, birden fazlası ikişerli kutular; sayı tekse son görsel tam genişlikte (boşluk kalmaz).
  const items = b.ad_ids.map((id) => ads.find((a) => a.id === id)).filter((a): a is Ad => !!a);
  if (!items.length) return null;
  return <AdGrid ads={items} cls="hb-banner" label={b.title || "Afiş"} title={b.title} />;
}
