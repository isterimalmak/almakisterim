import type { Metadata } from "next";
import Link from "next/link";
import { Corporate } from "@/components/Corporate";
import { Markdown } from "@/components/Markdown";
import { serverApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Sık Sorulan Sorular | almakisterim.com",
  description: "Talep verme, satıcıların alıcıya ulaşması, numara gizliliği, hesap ve güvenli alışveriş hakkında sık sorulan sorular.",
};
type Item = { group: string; q: string; a: string };

// Cevaplardaki Markdown bağlantıları arama motorları için düz metne çevrilir.
const plain = (s: string) => s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*?([^*]+)\*\*?/g, "$1");

export default async function Sss() {
  const items = (await serverApi<{ items: Item[] }>("/faq"))?.items ?? [];
  const groups = [...new Set(items.map((x) => x.group))];
  const ld = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: items.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: plain(x.a) } })) };
  return (
    <Corporate active="/sss" title="Sık Sorulan Sorular">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      {groups.length > 1 && <nav className="faq-nav" aria-label="Konular">{groups.map((g, i) => <a key={g} href={`#g${i}`}>{g}</a>)}</nav>}
      {groups.map((g, i) => (
        <section key={g} id={`g${i}`} className="faq-group">
          <h2>{g}</h2>
          {items.filter((x) => x.group === g).map((x) => (
            <details key={x.q} className="faq-item"><summary>{x.q}</summary><div className="faq-a"><Markdown text={x.a} /></div></details>
          ))}
        </section>
      ))}
      <p className="corp-note">Aradığınız cevabı bulamadınız mı? <Link className="link" href="/sayfa/iletisim">İletişim</Link> sayfasından bize ulaşabilirsiniz.</p>
    </Corporate>
  );
}
