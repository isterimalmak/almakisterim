"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
          ? <AdVideo src={a.media.url} label={a.title || "Tanıtım videosu"} />
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

// Tarayıcılar sesli videonun kendiliğinden oynamasına izin vermez: video sessiz başlar,
// köşedeki düğmeye dokununca ses açılır.
function AdVideo({ src, label }: { src: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const v = ref.current;
    if (!v) return;
    v.muted = !muted;
    if (!v.muted) void v.play().catch(() => {});
    setMuted(v.muted);
  };
  return (
    <>
      <video ref={ref} src={src} autoPlay muted loop playsInline preload="metadata" aria-label={label} />
      <button type="button" className="yk-ses" onClick={toggle} aria-label={muted ? "Sesi aç" : "Sesi kapat"} title={muted ? "Sesi aç" : "Sesi kapat"}>
        {muted
          ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5 6 9H3v6h3l5 4z" /><path d="m22 9-6 6M16 9l6 6" /></svg>
          : <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg>}
      </button>
    </>
  );
}
