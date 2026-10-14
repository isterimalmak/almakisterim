import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { serverApi } from "@/lib/server-api";
import { dateTr } from "@/lib/format";

export const dynamic = "force-dynamic";
type Post = { slug: string; title: string; summary: string; body: string; published_at: string };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await serverApi<Post>(`/blog/${encodeURIComponent((await params).slug)}`);
  if (!p) return { title: "Yazı bulunamadı | almakisterim.com" };
  return { title: `${p.title} | almakisterim.com`, description: p.summary, openGraph: { title: p.title, description: p.summary, type: "article" } };
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const p = await serverApi<Post>(`/blog/${encodeURIComponent((await params).slug)}`);
  if (!p) notFound();
  return (
    <div className="wrap" style={{ maxWidth: 820, paddingBottom: 40 }}>
      <div className="crumb"><Link href="/">Ana Sayfa</Link> › <Link href="/blog">Blog</Link> › {p.title}</div>
      <article className="box blog-post">
        <div className="box-b">
          <h1>{p.title}</h1>
          <small className="muted">{dateTr(p.published_at)}</small>
          <Markdown text={p.body} />
        </div>
      </article>
      <div className="blog-cta">
        <div><b>Almak istediğiniz bir şey mi var?</b><p>Ne aradığınızı yazın, satıcılar size ulaşsın. Ücretsiz.</p><Link className="btn btn-or" href="/talep-ver">Ücretsiz Talep Ver</Link></div>
        <div><b>Satıcı mısınız?</b><p>Elinizdekini almak isteyen biri talep verince haber alın.</p><Link className="btn btn-bl" href="/bana-ozel?s=alarm">Talep Alarmı Kur</Link></div>
      </div>
    </div>
  );
}
