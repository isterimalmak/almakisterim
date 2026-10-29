import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { serverApi, siteData } from "@/lib/server-api";
import { dateTr } from "@/lib/format";
import { alimTalepleri, ldJson, OG_BASE, ogImage, SITE_URL, talepPath } from "@/lib/seo";
import type { RequestItem } from "@/lib/api";

export const dynamic = "force-dynamic";
type Post = { slug: string; title: string; summary: string; body: string; published_at: string; top: string | null };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await serverApi<Post>(`/blog/${encodeURIComponent((await params).slug)}`);
  if (!p) return { title: "Yazı bulunamadı" };
  return { title: p.title, description: p.summary, alternates: { canonical: `/blog/${p.slug}` }, openGraph: { ...OG_BASE, title: p.title, description: p.summary, type: "article", url: `/blog/${p.slug}`, publishedTime: p.published_at, images: ogImage("blog", p.slug) } };
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const p = await serverApi<Post>(`/blog/${encodeURIComponent((await params).slug)}`);
  if (!p) notFound();
  // Yazının kategorisindeki güncel talepler: okuyanı talebe, arama motorunu kategoriye götürür.
  const [cats, rel] = p.top ? await Promise.all([
    siteData(),
    serverApi<{ items: RequestItem[] }>(`/requests?top=${encodeURIComponent(p.top)}&per=5`),
  ]) : [null, null];
  const top = cats?.categories.find((c) => c.id === p.top);
  return (
    <div className="wrap" style={{ maxWidth: 820, paddingBottom: 40 }}>
      {/* Google için yazı bilgisi: başlık, tarih, yayıncı; ve yol çubuğu. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([
        {
          "@context": "https://schema.org", "@type": "BlogPosting",
          headline: p.title, description: p.summary, datePublished: p.published_at,
          mainEntityOfPage: `${SITE_URL}/blog/${p.slug}`, image: `${SITE_URL}/og/blog/${encodeURIComponent(p.slug)}`, inLanguage: "tr-TR",
          author: { "@type": "Organization", name: "almakisterim.com", url: SITE_URL },
          publisher: { "@type": "Organization", name: "almakisterim.com", logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` } },
        },
        {
          "@context": "https://schema.org", "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
            { "@type": "ListItem", position: 3, name: p.title, item: `${SITE_URL}/blog/${p.slug}` },
          ],
        },
      ]) }} />
      <div className="crumb"><Link href="/">Ana Sayfa</Link> › <Link href="/blog">Blog</Link> › {p.title}</div>
      <article className="box blog-post">
        <div className="box-b">
          <h1>{p.title}</h1>
          <small className="muted">{dateTr(p.published_at)}</small>
          <Markdown text={p.body} />
        </div>
      </article>
      {top && !!rel?.items.length && (
        <section className="box blog-rel" aria-label="İlgili alım talepleri">
          <div className="box-h"><h2>Güncel {alimTalepleri(top.name)}</h2><Link className="link" href={`/kategori/${top.id}`}>Tümü ›</Link></div>
          <ul className="box-b">
            {rel.items.map((r) => <li key={r.id}><Link href={talepPath(r)}>{r.title}</Link> <span className="muted">· {r.city}</span></li>)}
          </ul>
        </section>
      )}
      <div className="blog-cta">
        <div><b>Almak istediğiniz bir şey mi var?</b><p>Ne aradığınızı yazın, satıcılar size ulaşsın. Ücretsiz.</p><Link className="btn btn-or" href="/talep-ver">Ücretsiz Talep Ver</Link></div>
        <div><b>Satıcı mısınız?</b><p>Elinizdekini almak isteyen biri talep verince haber alın.</p><Link className="btn btn-bl" href="/bana-ozel?s=alarm">Talep Alarmı Kur</Link></div>
      </div>
    </div>
  );
}
