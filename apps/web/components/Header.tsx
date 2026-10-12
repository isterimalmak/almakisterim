"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { initials } from "@/lib/format";
import { Icon } from "./Icon";
import { useSession } from "./Session";

function SearchForm({ compact }: { compact?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form className="search" onSubmit={(e) => { e.preventDefault(); router.push(`/kategori?q=${encodeURIComponent(q.trim())}`); }}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={compact ? "Talep ara" : "Kelime, talep no veya kategori ile ara"} aria-label="Talep ara" />
      <button type="submit">{!compact && <Icon name="search" size={16} sw={2.4} />}Ara</button>
    </form>
  );
}

export function Header() {
  const { user, categories } = useSession();
  const path = usePathname();
  return (
    <>
      <header className="hdr">
        <div className="wrap hdr-in">
          <Link href="/" className="logo" aria-label="almakisterim.com ana sayfa"><span className="logo-mark">a</span><span className="logo-txt">almakisterim<span>.com</span></span></Link>
          <SearchForm />
          <div className="hdr-right">
            {user ? (
              <>
                <Link className="t" href="/bana-ozel">Bana Özel</Link>
                <span className="credit">{user.free_offers_left} ücretsiz · {user.credits} kredi</span>
                <Link href="/bana-ozel" title="Bana Özel"><span className="av">{initials(user.name || "Üye")}</span></Link>
              </>
            ) : (
              <>
                <Link className="t" href="/giris">Giriş Yap</Link>
                <Link className="t" href="/giris">Hesap Aç</Link>
              </>
            )}
            <Link href="/talep-ver" className="btn btn-or"><span>+ <span className="lg">Ücretsiz </span>Talep Ver</span></Link>
          </div>
        </div>
        <div className="mob-search"><SearchForm compact /></div>
      </header>
      <nav className="subnav" aria-label="Kategoriler">
        <div className="wrap subnav-in">
          <Link href="/" className={path === "/" ? "on" : ""}>Ana Sayfa</Link>
          {categories.map((t) => <Link key={t.id} href={`/kategori/${t.id}`} className={path.startsWith(`/kategori/${t.id}`) ? "on" : ""}>{t.name}</Link>)}
          {user?.role === "admin" && <Link href="/yonetim" className={path === "/yonetim" ? "on" : ""}>Yönetim Paneli</Link>}
        </div>
      </nav>
    </>
  );
}

export function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="ft">
          <div><b>Kurumsal</b><Link href="/sayfa/hakkimizda">Hakkımızda</Link><Link href="/sayfa/iletisim">İletişim</Link></div>
          <div><b>Alıcılar İçin</b><Link href="/talep-ver">Ücretsiz Talep Ver</Link><Link href="/kategori">Tüm Talepler</Link><Link href="/sayfa/guvenli-alisveris">Güvenli Alışveriş İpuçları</Link></div>
          <div><b>Satıcılar İçin</b><Link href="/bana-ozel?s=eslesme">Size Uygun Talepler</Link><Link href="/bana-ozel?s=kredi">Kredi ve Mağaza</Link><Link href="/bana-ozel?s=alarm">Talep Alarmları</Link></div>
          <div><b>Gizlilik ve Kullanım</b><Link href="/sayfa/kullanim-kosullari">Kullanım Koşulları</Link><Link href="/sayfa/kvkk">KVKK Aydınlatma Metni</Link><Link href="/sayfa/cerez">Çerez Politikası</Link></div>
        </div>
        <div className="ft-bottom"><span>© {new Date().getFullYear()} almakisterim.com</span><span>Telefon numaranız satıcılarla paylaşılmaz.</span></div>
      </div>
    </footer>
  );
}
