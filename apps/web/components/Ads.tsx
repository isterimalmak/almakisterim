"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Ad } from "@/lib/api";

// Yöneticinin eklediği reklam kutuları, alt alta. Hiç reklam yoksa hiçbir şey göstermez.
export function Ads({ cls = "" }: { cls?: string }) {
  const [ads, setAds] = useState<Ad[]>([]);
  useEffect(() => { void api<{ items: Ad[] }>("/tanitim").then((r) => setAds(r.items)).catch(() => {}); }, []);
  if (!ads.length) return null;
  return (
    <div className={"yk-list " + cls} aria-label="Tanıtımlar">
      {ads.map((a) => {
        const body = a.media.kind === "video"
          ? <video src={a.media.url} autoPlay muted loop playsInline preload="metadata" aria-label={a.title || "Tanıtım videosu"} />
          : <img src={a.media.url} alt={a.title || "Tanıtım"} loading="lazy" />;
        const inner = <>{body}<span className="yk-etiket">Reklam</span></>;
        if (!a.link_url) return <div key={a.id} className="yk">{inner}</div>;
        return a.link_url.startsWith("/")
          ? <Link key={a.id} className="yk" href={a.link_url}>{inner}</Link>
          : <a key={a.id} className="yk" href={a.link_url} target="_blank" rel="sponsored noopener noreferrer">{inner}</a>;
      })}
    </div>
  );
}
