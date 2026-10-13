"use client";

import { useEffect, useRef, useState } from "react";
import { api, type Ad } from "@/lib/api";
import { keepPlaying, useResumeOnShow } from "./Ads";

const KEY = "ak_karsilama";

// Karşılama: yöneticinin "Açılışta göster" dediği reklam, siteye girişte ekranın ortasında açılır.
// Aynı oturumda bir kez gösterilir. Video sesli başlatılmaya çalışılır; tarayıcı izin vermezse
// sessiz oynar ve ziyaretçinin ilk dokunuşunda ses açılır.
export function Welcome() {
  const [ad, setAd] = useState<Ad | null>(null);
  useEffect(() => {
    void api<{ welcome?: Ad | null }>("/tanitim").then((r) => {
      if (!r.welcome) return;
      try { if (sessionStorage.getItem(KEY) === String(r.welcome.id)) return; } catch { /* yoksay */ }
      setAd(r.welcome);
    }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!ad) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ad) return null;
  const close = () => {
    try { sessionStorage.setItem(KEY, String(ad.id)); } catch { /* yoksay */ }
    setAd(null);
  };
  const go = () => {
    if (!ad.link_url) return;
    close();
    if (ad.link_url.startsWith("/")) window.location.assign(ad.link_url);
    else window.open(ad.link_url, "_blank", "noopener,noreferrer");
  };
  return (
    <div className="ov show krs-ov" onClick={close}>
      <div className="krs" role="dialog" aria-label="Hoş geldiniz" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="krs-x" aria-label="Kapat" onClick={close}>×</button>
        <div className={ad.link_url ? "krs-m krs-link" : "krs-m"} onClick={go}>
          {ad.media.kind === "video" ? <WelcomeVideo src={ad.media.url} label={ad.title || "Karşılama videosu"} /> : <img src={ad.media.url} alt={ad.title || "Karşılama"} />}
        </div>
        {ad.link_url && <button type="button" className="btn btn-or krs-go" onClick={go}>İncele</button>}
      </div>
    </div>
  );
}

function WelcomeVideo({ src, label }: { src: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);
  useResumeOnShow(ref);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // Önce sesli dene; tarayıcı engellerse sessiz oynat, ilk dokunuşta sesi aç.
    v.muted = false;
    v.play().then(() => setMuted(false)).catch(() => { v.muted = true; setMuted(true); void v.play().catch(() => {}); });
    // İlk dokunuşta ses açılır (ses düğmesine basılmışsa düğme kendisi karar verir); sonra dinleme biter.
    const stop = () => { document.removeEventListener("pointerdown", unmute); document.removeEventListener("keydown", unmute); };
    function unmute(e: Event) {
      stop();
      if ((e.target as Element | null)?.closest?.(".krs-ses") || !v!.muted) return;
      v!.muted = false; setMuted(false); void v!.play().catch(() => {});
    }
    document.addEventListener("pointerdown", unmute);
    document.addEventListener("keydown", unmute);
    return stop;
  }, []);
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    void v.play().catch(() => {});
  };
  return (
    <>
      <video ref={ref} src={src} loop playsInline preload="auto" aria-label={label} {...keepPlaying} />
      <button type="button" className={muted ? "krs-ses on" : "krs-ses"} onClick={toggle} aria-label={muted ? "Sesi aç" : "Sesi kapat"}>
        {muted ? "🔇 Sesi aç" : "🔊"}
      </button>
    </>
  );
}
