import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dateLong, type LegalDoc } from "@/lib/legal";
import { serverApi } from "@/lib/server-api";
import { PrintButton } from "./PrintButton";
import { Corporate } from "@/components/Corporate";

export const dynamic = "force-dynamic";
type Version = { version: string; effective: string; reconsent: boolean };
const load = async (slug: string, v?: string) => serverApi<{ doc: LegalDoc; versions: Version[] }>(`/legal/${encodeURIComponent(slug)}${v ? `?v=${encodeURIComponent(v)}` : ""}`);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const d = (await load((await params).slug))?.doc;
  return d ? { title: `${d.title} | almakisterim.com`, description: d.summary } : { title: "Metin bulunamadı | almakisterim.com" };
}

const anchor = (i: number) => `m${i + 1}`;

export default async function LegalPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ v?: string }> }) {
  const { slug } = await params;
  const { v } = await searchParams;
  const data = await load(slug, v);
  if (!data) notFound();
  const d = data.doc;
  const latest = data.versions[0]?.version;
  return (
    <Corporate active={`/sozlesmeler/${slug}`} title={d.title} crumbs={[["/sozlesmeler", "Sözleşmeler ve Kurallar"]]}>
      <div className="legal-doc">
          <p className="legal-meta">Sürüm {d.version} · Yürürlük tarihi: {dateLong(d.effective)} <PrintButton /></p>
          {latest && d.version !== latest && <div className="note n-warn" style={{ marginBottom: 10 }}><span>Bu metnin eski bir sürümünü görüntülüyorsunuz. <Link className="link" href={`/sozlesmeler/${slug}`}>Yürürlükteki sürüm ({latest}) »</Link></span></div>}
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
          {data.versions.length > 1 && (
            <section className="legal-versions">
              <h2>Sürüm geçmişi</h2>
              <ul>{data.versions.map((x) => <li key={x.version}>{x.version === d.version ? <b>Sürüm {x.version}</b> : <Link className="link" href={`/sozlesmeler/${slug}?v=${x.version}`}>Sürüm {x.version}</Link>} · {dateLong(x.effective)}{x.reconsent ? " · esaslı değişiklik" : ""}</li>)}</ul>
            </section>
          )}
      </div>
    </Corporate>
  );
}
