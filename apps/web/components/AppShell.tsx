"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { useSession } from "./Session";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const KEY = "ak_yukle_kapat";

// Telefonda uygulama görünümü: altta sekme çubuğu, "uygulamayı yükle" önerisi ve bağlantı yokken gösterilen ekran.
export function AppShell() {
  const { user } = useSession();
  const path = usePathname();
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hide, setHide] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => {});
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try { dismissed = !!localStorage.getItem(KEY); } catch { /* gizli sekme */ }
    if (standalone || dismissed) return;
    setHide(false);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent));
    const on = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent); };
    window.addEventListener("beforeinstallprompt", on);
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);

  const close = () => { setHide(true); try { localStorage.setItem(KEY, "1"); } catch { /* yoksay */ } };
  const install = async () => { if (!evt) return; await evt.prompt(); await evt.userChoice.catch(() => null); setEvt(null); close(); };

  const tabs = [
    { href: "/", label: "Ana Sayfa", icon: "home", on: path === "/" },
    { href: "/kategori", label: "Talepler", icon: "list", on: path.startsWith("/kategori") },
    { href: "/talep-ver", label: "Talep Ver", icon: "plus", on: path.startsWith("/talep-ver"), main: true },
    { href: user ? "/bana-ozel?s=bildirim" : "/giris", label: "Bildirimler", icon: "bell", on: false, badge: user?.unread_notifications ?? 0 },
    { href: user ? "/bana-ozel" : "/giris", label: user ? "Hesabım" : "Giriş", icon: "user", on: path.startsWith("/bana-ozel") || path.startsWith("/giris") },
  ];

  return (
    <>
      {!hide && (evt || ios) && (
        <div className="app-install" role="dialog" aria-label="Uygulamayı yükle">
          <span className="app-ic" aria-hidden="true">a</span>
          <div className="app-tx"><b>almakisterim uygulaması</b><span>{evt ? "Ana ekranınıza ekleyin, tek dokunuşla açın." : <>Paylaş <span aria-hidden="true">⎋</span> → <b>Ana Ekrana Ekle</b> ile yükleyin.</>}</span></div>
          {evt && <button className="btn btn-or btn-sm" onClick={install}>Yükle</button>}
          <button className="app-x" aria-label="Kapat" onClick={close}>×</button>
        </div>
      )}
      <nav className="tabbar" aria-label="Uygulama menüsü">
        {tabs.map((t) => (
          <Link key={t.label} href={t.href} className={(t.on ? "on" : "") + (t.main ? " main" : "")} aria-current={t.on ? "page" : undefined}>
            <span className="tb-ic"><Icon name={t.icon} size={t.main ? 24 : 22} sw={t.main ? 2.4 : 1.9} />{!!t.badge && <span className="badge">{t.badge}</span>}</span>
            <span className="tb-l">{t.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
