"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { consent, visitorId } from "@/lib/consent";

// Yönetim → Ziyaretçiler için sayfa kaydı: hangi sayfaya girildi, ne kadar kalındı, nereden çıkıldı.
// Yalnız çerez kutusunda "Kabul et" denmişse çalışır; yönetim sayfaları kaydedilmez.
type Cur = { id: number; visitor: string; at: number } | null;

function leave(cur: Cur, beacon = false) {
  if (!cur) return;
  const body = JSON.stringify({ id: cur.id, visitor: cur.visitor, ms: Date.now() - cur.at });
  if (beacon && navigator.sendBeacon) { navigator.sendBeacon("/api/track/leave", new Blob([body], { type: "text/plain" })); return; }
  void fetch("/api/track/leave", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true, credentials: "same-origin" }).catch(() => {});
}

export function PageTracker() {
  const path = usePathname();
  const cur = useRef<Cur>(null);
  const first = useRef(true);

  useEffect(() => {
    let alive = true;
    const start = () => {
      leave(cur.current);
      cur.current = null;
      const visitor = visitorId();
      if (!visitor || !path || path.startsWith("/yonetim")) return;
      let ref = "";
      if (first.current) {
        try { ref = document.referrer ? new URL(document.referrer).hostname.toLowerCase() : ""; } catch { ref = ""; }
        if (ref === location.hostname) ref = "";
      }
      first.current = false;
      const device = matchMedia("(max-width: 760px)").matches || /Mobi|Android|iPhone/i.test(navigator.userAgent) ? "mobil" : "masaustu";
      const at = Date.now();
      void fetch("/api/track", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ visitor, path: location.pathname, ref: ref.replace(/[^a-z0-9.-]/g, "").slice(0, 100), device }) })
        .then((r) => (r.ok ? r.json() : null))
        .then((x: { id: number | null } | null) => { if (alive && x?.id) cur.current = { id: x.id, visitor, at }; })
        .catch(() => {});
    };
    if (consent() === "evet") start();
    // Ziyaretçi bu sayfada "Kabul et" derse kayıt o andan başlar.
    const onConsent = () => { if (consent() === "evet" && !cur.current) start(); else if (consent() !== "evet") cur.current = null; };
    window.addEventListener("ak-cerez", onConsent);
    return () => { alive = false; window.removeEventListener("ak-cerez", onConsent); };
  }, [path]);

  // Sekme kapanırken ya da arka plana alınırken o sayfada geçen süre gönderilir.
  useEffect(() => {
    const out = () => { leave(cur.current, true); cur.current = null; };
    const vis = () => { if (document.visibilityState === "hidden") out(); };
    window.addEventListener("pagehide", out);
    document.addEventListener("visibilitychange", vis);
    return () => { window.removeEventListener("pagehide", out); document.removeEventListener("visibilitychange", vis); };
  }, []);
  return null;
}
