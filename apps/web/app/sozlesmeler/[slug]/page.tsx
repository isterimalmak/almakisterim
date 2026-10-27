import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dateLong, type LegalDoc } from "@/lib/legal";
import { serverApi } from "@/lib/server-api";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";
const load = async (slug: string) => (await serverApi<{ doc: LegalDoc }>(`/legal/${encodeURIComponent(slug)}`))?.doc ?? null;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const d = await load((await params).slug);
  return d ? { title: `${d.title} | almakisterim.com`, description: d.summary } : { title: "Metin bulunamadı | almakisterim.com" };
}

const anchor = (i: number) => `m${i + 1}`;

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const d = await load((await params).slug);
  if (!d) notFound();
  return (
    <div className="wrap" style={{ maxWidth: 900, paddingBottom: 40 }}>
      <div className="crumb"><Link href="/">Ana Sayfa</Link> › <Link href="/sozlesmeler">Sözleşmeler ve Kurallar</Link> › {d.title}</div>
      <article className="box legal-doc">
        <div className="box-b">
          <h1>{d.title}</h1>
          <p className="legal-meta">Sürüm {d.version} · Yürürlük tarihi: {dateLong(d.effective)} <PrintButton /></p>
          {d.sections.length > 3 && (
            <nav className="legal-toc" aria-label="İçindekiler">
              <b>İçindekiler</b>
              <ol>{d.sections.map((s, i) => <li key={s.h}><a href={`#${anchor(i)}`}>{s.h}</a></li>)}</ol>
            </nav>
          )}
          {d.sections.map((s, i) => (
            <section key={s.h} id={anchor(i)}>
              <h2>{s.h}</h2>
              {s.p.map((p, j) => (p.startsWith("• ") ? <p key={j} className="legal-li">{p.slice(2)}</p> : <p key={j}>{p}</p>))}
            </section>
          ))}
        </div>
      </article>
      <p className="muted" style={{ fontSize: 12.5 }}>Sorularınız için <a className="link" href="/sayfa/iletisim">İletişim</a> sayfasından bize ulaşabilirsiniz. Tüm metinler: <Link className="link" href="/sozlesmeler">Sözleşmeler ve Kurallar</Link>.</p>
    </div>
  );
}
