import Link from "next/link";
import type { ReactNode } from "react";
import { serverApi } from "@/lib/server-api";

// Kurumsal sayfaların ortak düzeni: solda menü, sağda başlık ve içerik (Hakkımızda, SSS, sözleşmeler, İletişim…).
const POLICIES: [string, string][] = [
  ["/sozlesmeler", "Tüm Sözleşmeler ve Kurallar"],
  ["/sozlesmeler/uyelik-sozlesmesi", "Üyelik Sözleşmesi"],
  ["/sozlesmeler/talep-verme-kurallari", "Talep Verme Kuralları"],
  ["/sozlesmeler/kvkk-aydinlatma-metni", "KVKK Aydınlatma Metni"],
  ["/sozlesmeler/cerez-politikasi", "Çerez Politikası"],
  ["/sozlesmeler/hesap-silme", "Hesap Silme"],
];

export async function Corporate({ active, title, crumbs = [], children }: { active: string; title: string; crumbs?: [string, string][]; children: ReactNode }) {
  const pages = (await serverApi<{ items: { slug: string; title: string }[] }>("/pages"))?.items ?? [];
  const top = pages.filter((p) => p.slug !== "iletisim");
  const contact = pages.find((p) => p.slug === "iletisim");
  const inPolicies = active.startsWith("/sozlesmeler") && active !== "/sozlesmeler/guvenli-alisveris";
  const item = (href: string, label: string) => <Link key={href} href={href} className={"corp-i" + (active === href ? " on" : "")} aria-current={active === href ? "page" : undefined}>{label}</Link>;
  return (
    <div className="wrap corp">
      <div className="crumb"><Link href="/">Ana Sayfa</Link>{crumbs.map(([h, l]) => <span key={h}> › <Link href={h}>{l}</Link></span>)} › {title}</div>
      <div className="corp-grid">
        <nav className="corp-nav" aria-label="Kurumsal">
          {top.slice(0, 1).map((p) => item(`/sayfa/${p.slug}`, p.title))}
          {item("/sss", "Sık Sorulan Sorular")}
          {top.slice(1).map((p) => item(`/sayfa/${p.slug}`, p.title))}
          <details className="corp-grp" open={inPolicies}>
            <summary className={"corp-i" + (inPolicies ? " in" : "")}>Politikalarımız</summary>
            {POLICIES.map(([h, l]) => item(h, l))}
          </details>
          {item("/sozlesmeler/guvenli-alisveris", "Güvenli Alışveriş")}
          {item("/blog", "Blog")}
          {contact && item("/sayfa/iletisim", contact.title)}
        </nav>
        <article className="corp-main">
          <h1>{title}</h1>
          <div className="corp-body">{children}</div>
        </article>
      </div>
    </div>
  );
}
