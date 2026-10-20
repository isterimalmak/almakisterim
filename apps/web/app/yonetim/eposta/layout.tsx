"use client";

import "./eposta.css";
import Link from "next/link";
import { useSession } from "@/components/Session";

// Yönetim → E-posta Stüdyosu: liste (/yonetim/eposta) ve düzenleyici (/yonetim/eposta/[id]) aynı çerçevede, yalnızca yöneticiye.
export default function MailStudioLayout({ children }: { children: React.ReactNode }) {
  const { user, ready } = useSession();
  if (!ready) return <div className="loading">Yükleniyor…</div>;
  if (user?.role !== "admin") return <div className="wrap" style={{ padding: "30px 16px" }}><div className="box"><div className="empty">Bu sayfa yalnızca yöneticiler içindir. <Link className="link" href="/giris?sonra=/yonetim/eposta">Yönetici hesabıyla giriş yapın</Link>.</div></div></div>;
  return (
    <div className="ms-shell">
      <div className="ap-top">
        <Link className="btn btn-wh btn-sm" href="/yonetim">‹ Yönetim Paneli</Link>
        <div><small>Yönetim Paneli › İçerik › <b>E-posta Stüdyosu</b></small></div>
      </div>
      <div className="ap-body ms-root">{children}</div>
    </div>
  );
}
