"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { api, type Ad, type RequestItem } from "@/lib/api";
import { SPEEDS, type HomeBlock } from "@/lib/home";
import { AdMedia, adDevice } from "./Ads";
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

export function CustomBlock({ b, ads }: { b: Exclude<HomeBlock, { type: "builtin" }>; ads: Ad[] }) {
  if (b.type === "showcase") return <Showcase b={b} />;
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
    return <Go href={b.href} className="hb-mq" label={b.text}><span className="hb-mq-in" style={{ background: b.bg, color: b.fg }}><span className="hb-mq-track">{row}{row}</span></span></Go>;
  }
  // Afiş: tek görsel geniş, birden fazlası yan yana kutular.
  const items = b.ad_ids.map((id) => ads.find((a) => a.id === id)).filter((a): a is Ad => !!a);
  if (!items.length) return null;
  return (
    <section className={"hb-banner" + (items.length === 1 ? " tek" : "")} aria-label={b.title || "Afiş"}>
      {b.title && <h2 className="hb-banner-h">{b.title}</h2>}
      <div className="hb-banner-g">{items.map((a) => <Go key={a.id} href={a.link_url} className={"yk" + adDevice(a)}>{<AdMedia a={a} />}</Go>)}</div>
    </section>
  );
}
