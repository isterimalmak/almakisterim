"use client";

import { useEffect, useRef, useState } from "react";
import { api, type Ad } from "@/lib/api";
import { keepPlaying, useResumeOnShow } from "./Ads";

const KEY = "ak_karsilama";

// Karşılama: yöneticinin "Açılışta göster" dediği reklam, siteye girişte ekranın ortasında açılır.
// Aynı oturumda bir kez gösterilir. Video sesli başlatılır; tarayıcı izin vermezse (ziyaretçi henüz
// sayfaya dokunmadıysa tarayıcılar sesi engeller) sessiz oynar ve sayfada ilk dokunuşta ses açılır.
export function Welcome() {
  const [ad, setAd] = useState<Ad | null>(null);
  // Tarayıcı sesli başlatmaya izin vermediyse videoya ilk dokunuş yalnız sesi açar, bağlantıya gitmez.
  const soundPending = useRef(false);
  useEffect(() => {
    void api<{ welcome?: Ad | null }>("/tanitim").then((r) => {
      if (!r.welcome) return;
      // Yalnız telefonda / yalnız bilgisayarda seçilen reklam öbür cihazda açılmaz.
      const wide = window.matchMedia("(min-width: 861px)").matches;
      if ((r.welcome.device === "mobile" && wide) || (r.welcome.device === "desktop" && !wide)) return;
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
        <div className={ad.link_url ? "krs-m krs-link" : "krs-m"} onClick={() => { if (soundPending.current) { soundPending.current = false; return; } go(); }}>
          {ad.media.kind === "video"
            ? <WelcomeVideo src={ad.media.url} label={ad.title || "Karşılama videosu"} onMuted={(m) => { soundPending.current = m; }} />
            : <img src={ad.media.url} alt={ad.title || "Karşılama"} />}
        </div>
        {ad.link_url && <button type="button" className="btn btn-or krs-go" onClick={go}>İncele</button>}
      </div>
    </div>
  );
}

function WelcomeVideo({ src, label, onMuted }: { src: string; label: string; onMuted: (muted: boolean) => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);
  useResumeOnShow(ref);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // Önce sesli dene; tarayıcı engellerse sessiz oynat, ilk dokunuşta sesi aç.
    v.muted = false;
    v.play().then(() => setMuted(false)).catch(() => { v.muted = true; setMuted(true); onMuted(true); void v.play().catch(() => {}); });
    // İlk dokunuşta ses açılır (ses düğmesine basılmışsa düğme kendisi karar verir); sonra dinleme biter.
    // Telefonda tarayıcı dokunuşu parmak kalkınca sayar (touchend/pointerup), bu yüzden hepsi dinlenir.
    const EVENTS = ["pointerdown", "pointerup", "touchend", "click", "keydown"] as const;
    const stop = () => EVENTS.forEach((n) => document.removeEventListener(n, unmute, true));
    function unmute(e: Event) {
      if ((e.target as Element | null)?.closest?.(".krs-ses")) { stop(); return; }
      if (!v!.muted) { stop(); return; }
      v!.muted = false;
      // Tarayıcı bu dokunuşu henüz izin saymadıysa video durur; o zaman sessize dönülür ve sonraki dokunuş beklenir.
      v!.play().then(() => { setMuted(false); stop(); }).catch(() => { v!.muted = true; void v!.play().catch(() => {}); });
    }
    EVENTS.forEach((n) => document.addEventListener(n, unmute, true));
    return stop;
  }, []);
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    onMuted(false);
    void v.play().catch(() => {});
  };
  return (
    <>
      <video ref={ref} src={src} loop playsInline preload="auto" aria-label={label} {...keepPlaying} />
      {muted
        // Ses kapalıyken ortada büyük düğme: telefonda tek dokunuşla ses açılır.
        ? <button type="button" className="krs-ses krs-ses-b" onClick={toggle}>🔊 Sesi açmak için dokunun</button>
        : <button type="button" className="krs-ses" onClick={toggle} aria-label="Sesi kapat">🔊</button>}
    </>
  );
}
