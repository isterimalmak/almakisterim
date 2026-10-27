import type { Metadata } from "next";
import Link from "next/link";
import { dateLong, LEGAL_GROUPS, type LegalItem } from "@/lib/legal";
import { serverApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Sözleşmeler ve Kurallar | almakisterim.com",
  description: "Üyelik Sözleşmesi, talep verme kuralları, Güvenli Al, KVKK aydınlatma metni, çerez politikası ve diğer metinler.",
};

export default async function Sozlesmeler() {
  const data = await serverApi<{ items: LegalItem[] }>("/legal");
  const bySlug = new Map((data?.items ?? []).map((d) => [d.slug, d]));
  return (
    <div className="wrap" style={{ maxWidth: 900, paddingBottom: 40 }}>
      <div className="crumb"><Link href="/">Ana Sayfa</Link> › Sözleşmeler ve Kurallar</div>
      <div className="list-head"><h1>Sözleşmeler ve Kurallar</h1></div>
      {LEGAL_GROUPS.map((g) => (
        <section key={g.title} className="box legal-group">
          <div className="box-h"><h2>{g.title}</h2></div>
          <div className="box-b legal-list">
            {g.slugs.map((s) => bySlug.get(s)).filter((d): d is LegalItem => !!d).map((d) => (
              <Link key={d.slug} href={`/sozlesmeler/${d.slug}`} className="legal-card">
                <b>{d.title}</b><span>{d.summary}</span><small>Sürüm {d.version} · Yürürlük: {dateLong(d.effective)}</small>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
