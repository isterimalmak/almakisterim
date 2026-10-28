import type { Metadata } from "next";
import Link from "next/link";
import { Corporate } from "@/components/Corporate";
import { dateLong, LEGAL_GROUPS, type LegalItem } from "@/lib/legal";
import { serverApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Sözleşmeler ve Kurallar",
  description: "Üyelik Sözleşmesi, talep verme kuralları, Güvenli Al, KVKK aydınlatma metni, çerez politikası ve diğer metinler.",
};

export default async function Sozlesmeler() {
  const data = await serverApi<{ items: LegalItem[] }>("/legal");
  const bySlug = new Map((data?.items ?? []).map((d) => [d.slug, d]));
  return (
    <Corporate active="/sozlesmeler" title="Sözleşmeler ve Kurallar">
      {LEGAL_GROUPS.map((g) => {
        const docs = g.slugs.map((s) => bySlug.get(s)).filter((d): d is LegalItem => !!d);
        return docs.length ? (
          <section key={g.title} className="legal-group">
            <h2>{g.title}</h2>
            <table className="corp-table legal-tbl"><tbody>{docs.map((d) => (
              <tr key={d.slug}><th scope="row"><Link className="link" href={`/sozlesmeler/${d.slug}`}>{d.title}</Link></th>
                <td>{d.summary}<small>Sürüm {d.version} · Yürürlük: {dateLong(d.effective)}</small></td></tr>
            ))}</tbody></table>
          </section>
        ) : null;
      })}
    </Corporate>
  );
}
