"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { initials } from "@/lib/format";
import { withYear } from "@/lib/footer";
import { Icon } from "./Icon";
import { useSession } from "./Session";

function SearchForm({ compact }: { compact?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form className="search" onSubmit={(e) => { e.preventDefault(); router.push(`/kategori?q=${encodeURIComponent(q.trim())}`); }}>
      {/* Telefonda Trendyol'daki gibi: turuncu büyüteç kutunun başında, ayrı "Ara" düğmesi yok. */}
      {compact && <button type="submit" className="ms-go" aria-label="Ara"><Icon name="search" size={21} sw={2.4} /></button>}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={compact ? "Ne arıyorsunuz?" : "Kelime, talep no veya kategori ile ara"} aria-label="Talep ara" />
      {!compact && <button type="submit"><Icon name="search" size={16} sw={2.4} />Ara</button>}
    </form>
  );
}

export function Header() {
  const { user, browseCategories, siteName } = useSession();
  // "almakisterim.com" → "almakisterim" + ".com" (uzantı farklı renkte, telefonda gizli)
  const dot = siteName.lastIndexOf(".");
  const [nameMain, nameExt] = dot > 0 ? [siteName.slice(0, dot), siteName.slice(dot)] : [siteName, ""];
  const path = usePathname();
  return (
    <>
      <header className="hdr">
        <div className="wrap hdr-in">
          <Link href="/" className="logo" aria-label={`${siteName} ana sayfa`}><img className="logo-mark" src="/logo.png" alt="" width={36} height={36} /><span className="logo-txt">{nameMain}{nameExt && <span>{nameExt}</span>}</span></Link>
          <SearchForm />
          <div className="hdr-right">
            {user ? (
              <>
                <Link className="t" href="/bana-ozel">Bana Özel</Link>
                <Link href={user.unread_notifications > 0 ? "/bana-ozel?s=bildirim" : "/bana-ozel"} title="Bana Özel" className="av-link"><span className="av">{initials(user.name || "Üye")}</span>{user.unread_notifications > 0 && <span className="badge" aria-label={`${user.unread_notifications} okunmamış bildirim`}>{user.unread_notifications}</span>}</Link>
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
        {/* Telefonda tek satır: logo arama kutusunun başında, adı yazmaz (hesap ve bildirimler alt menüde). */}
        <div className="mob-search"><Link href="/" className="logo" aria-label={`${siteName} ana sayfa`}><img className="logo-mark" src="/logo.png" alt="" width={40} height={40} /></Link><SearchForm compact />
          <Link href={user ? "/bana-ozel?s=bildirim" : "/giris"} className="mh-ic" aria-label="Bildirimler"><Icon name="bell" size={25} sw={1.8} />{!!user?.unread_notifications && <span className="badge">{user.unread_notifications}</span>}</Link>
        </div>
      </header>
      {/* Telefonda "Ana Sayfa" alt menüde var; başka bağlantı yoksa bu şerit hiç gösterilmez. */}
      <nav className={"subnav" + (browseCategories.length || user?.role === "admin" ? "" : " sn-empty")} aria-label="Kategoriler">
        <div className="wrap subnav-in">
          <Link href="/" className={"sn-home" + (path === "/" ? " on" : "")}>Ana Sayfa</Link>
          {browseCategories.map((t) => <Link key={t.id} href={`/kategori/${t.id}`} className={path.startsWith(`/kategori/${t.id}`) ? "on" : ""}>{t.name}</Link>)}
          {user?.role === "admin" && <Link href="/yonetim" className={path === "/yonetim" ? "on" : ""}>Yönetim Paneli</Link>}
        </div>
      </nav>
    </>
  );
}

export function Footer() {
  const { footer } = useSession();
  // Site içi bağlantılar sayfa yenilemeden, dış bağlantılar yeni sekmede açılır.
  const link = (l: { label: string; href: string }) => (l.href.startsWith("/")
    ? <Link key={l.label + l.href} href={l.href}>{l.label}</Link>
    : <a key={l.label + l.href} href={l.href} {...(l.href.startsWith("https://") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{l.label}</a>);
  return (
    <footer>
      <div className="wrap">
        <div className="ft">
          {footer.columns.map((c) => <div key={c.title}><b>{c.title}</b>{c.links.map(link)}</div>)}
        </div>
        <div className="ft-bottom"><span>{withYear(footer.bottom_left)}</span><span>{footer.bottom_right}</span></div>
      </div>
    </footer>
  );
}
