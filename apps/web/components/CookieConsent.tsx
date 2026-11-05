"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { captureSource, consent, loadAnalytics, setConsent } from "@/lib/consent";

// Çerez kutusu: ilk ziyarette altta çıkar; "Kabul et" ve "Reddet" eşit ağırlıkta (KVKK çerez rehberi).
// Kabul edilince Google Analytics (yönetimde kimlik girildiyse) ve ilk geliş kaydı başlar. Alt bilgideki
// "Çerez tercihleri" bağlantısı kutuyu yeniden açar.
export function CookieConsent({ ga4 }: { ga4?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const apply = () => { if (consent() === "evet") { captureSource(); if (ga4) loadAnalytics(ga4); } };
    if (consent() === null) setOpen(true);
    apply();
    const reopen = () => setOpen(true);
    window.addEventListener("ak-cerez", apply);
    window.addEventListener("ak-cerez-ac", reopen);
    return () => { window.removeEventListener("ak-cerez", apply); window.removeEventListener("ak-cerez-ac", reopen); };
  }, [ga4]);
  if (!open) return null;
  const pick = (v: "evet" | "hayir") => { setConsent(v); setOpen(false); };
  return (
    <div className="cookie-bar" role="dialog" aria-label="Çerez tercihleri" aria-live="polite">
      <p>
        Siteyi geliştirmek için, <b>yalnızca onay verirseniz</b> ziyaret istatistiği tutan analiz çerezleri kullanırız. Zorunlu çerezler her zaman çalışır.{" "}
        <Link href="/sozlesmeler/cerez-politikasi">Çerez Politikası</Link>
      </p>
      <div className="cookie-btns">
        <button type="button" className="btn btn-wh" onClick={() => pick("hayir")}>Reddet</button>
        <button type="button" className="btn btn-or" onClick={() => pick("evet")}>Kabul et</button>
      </div>
    </div>
  );
}

// Alt bilgideki bağlantı: kutuyu yeniden açar.
export function CookieSettingsLink() {
  return <button type="button" className="ft-cookie" onClick={() => window.dispatchEvent(new Event("ak-cerez-ac"))}>Çerez tercihleri</button>;
}
