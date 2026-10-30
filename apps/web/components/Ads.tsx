"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, type Ad } from "@/lib/api";
import { isWide } from "@/lib/ad-layout";

// Reklam yalnız telefonda ya da yalnız bilgisayarda görünsün (Yönetim → Reklam Alanları → Hangi cihazda).
export const adDevice = (a: Ad) => (a.device === "mobile" ? " ad-m" : a.device === "desktop" ? " ad-d" : "");

// Bu cihazda görünecek reklamlar (telefon: 860 pikselden dar ekran). Izgaradaki boşluğu doğru hesaplamak için
// öbür cihaza ayrılmış reklamlar hiç çizilmez.
function useForDevice(ads: Ad[]) {
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 860px)");
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  if (narrow === null) return ads;
  return ads.filter((a) => (a.device === "mobile" ? narrow : a.device === "desktop" ? !narrow : true));
}

function AdBox({ a, wide }: { a: Ad; wide?: boolean }) {
  const cls = "yk" + adDevice(a) + (wide ? " tam" : "");
  const body = <AdMedia a={a} />;
  if (!a.link_url) return <div className={cls}>{body}</div>;
  return a.link_url.startsWith("/")
    ? <Link className={cls} href={a.link_url}>{body}</Link>
    : <a className={cls} href={a.link_url} target="_blank" rel="sponsored noopener noreferrer">{body}</a>;
}

// Izgarada ikişerli dizilir; sayı tekse son reklam tam genişlikte durur, böylece yanında boşluk kalmaz.
// Sayım bu cihazda görünenlere göre yapılır. Başlık (afiş bölümlerinde) yalnız görünen reklam varsa çizilir.
export function AdGrid({ ads, cls, label = "Tanıtımlar", title }: { ads: Ad[]; cls: string; label?: string; title?: string }) {
  const shown = useForDevice(ads);
  if (!shown.length) return null;
  return (
    <section className={cls + (shown.length === 1 ? " tek" : "")} aria-label={label}>
      {title && <h2 className="hb-banner-h">{title}</h2>}
      {shown.map((a, i) => <AdBox key={a.id} a={a} wide={isWide(i, shown.length)} />)}
    </section>
  );
}

// Sol sütundaki reklamlar: bilgisayarda kategorilerin altında alt alta, telefonda (yk-m) iki sütunlu ızgara.
// items verilirse (ana sayfa sunucudan hazır getirir) yeniden istenmez; sayfa açılırken reklam yeri kaymaz.
export function Ads({ cls = "", items }: { cls?: string; items?: Ad[] }) {
  const [ads, setAds] = useState<Ad[]>(items ?? []);
  useEffect(() => { if (!items) void api<{ items: Ad[] }>("/tanitim").then((r) => setAds(r.items)).catch(() => {}); }, [items]);
  if (!ads.length) return null;
  return <AdGrid ads={ads} cls={"yk-list " + cls} />;
}

export function AdMedia({ a }: { a: Ad }) {
  return a.media.kind === "video" ? <AdVideo src={a.media.url} label={a.title || "Tanıtım videosu"} /> : <img src={a.media.url} alt={a.title || "Tanıtım"} loading="lazy" />;
}

// Ana sayfanın ortasındaki reklam alanı (vitrin ve son talepler bölümlerinin yeri): resim ve videolar yan yana kutular hâlinde.
export function CenterAds({ items }: { items?: Ad[] }) {
  const [ads, setAds] = useState<Ad[]>(items ?? []);
  useEffect(() => { if (!items) void api<{ center?: Ad[] }>("/tanitim").then((r) => setAds(r.center ?? [])).catch(() => {}); }, [items]);
  if (!ads.length) return null;
  return <AdGrid ads={ads} cls="yk-orta" />;
}

// Tarayıcılar sesli videonun kendiliğinden oynamasına izin vermez: video sessiz başlar,
// köşedeki düğmeye dokununca ses açılır.
// Video hiç durmaz: tarayıcı duraklatırsa ya da sona gelirse yeniden oynatılır.
export const keepPlaying = {
  onPause: (e: React.SyntheticEvent<HTMLVideoElement>) => { const v = e.currentTarget; if (!v.ended) void v.play().catch(() => {}); },
  onEnded: (e: React.SyntheticEvent<HTMLVideoElement>) => { const v = e.currentTarget; v.currentTime = 0; void v.play().catch(() => {}); },
};

// Sekme arka plandan geri gelince video kaldığı yerden devam eder.
export function useResumeOnShow(ref: React.RefObject<HTMLVideoElement | null>) {
  useEffect(() => {
    const on = () => { if (document.visibilityState === "visible" && ref.current?.paused) void ref.current.play().catch(() => {}); };
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, [ref]);
}

function AdVideo({ src, label }: { src: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  useResumeOnShow(ref);
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
      <video ref={ref} src={src} autoPlay muted loop playsInline preload="auto" aria-label={label} {...keepPlaying} />
      <button type="button" className="yk-ses" onClick={toggle} aria-label={muted ? "Sesi aç" : "Sesi kapat"} title={muted ? "Sesi aç" : "Sesi kapat"}>
        {muted
          ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5 6 9H3v6h3l5 4z" /><path d="m22 9-6 6M16 9l6 6" /></svg>
          : <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg>}
      </button>
    </>
  );
}
