"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { Ad } from "@/lib/api";
import type { HomeBlock } from "@/lib/home";
import { AdMedia } from "./Ads";

// Yöneticinin ana sayfaya eklediği bölümler: yazı/duyuru, afiş (resim/video) ve kayan yazı bandı.

function Go({ href, className, children, label }: { href: string | null; className: string; children: ReactNode; label?: string }) {
  if (!href) return <div className={className}>{children}</div>;
  return href.startsWith("/")
    ? <Link className={className} href={href} aria-label={label}>{children}</Link>
    : <a className={className} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>{children}</a>;
}

export function CustomBlock({ b, ads }: { b: Exclude<HomeBlock, { type: "builtin" }>; ads: Ad[] }) {
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
      <div className="hb-banner-g">{items.map((a) => <Go key={a.id} href={a.link_url} className="yk">{<AdMedia a={a} />}</Go>)}</div>
    </section>
  );
}
