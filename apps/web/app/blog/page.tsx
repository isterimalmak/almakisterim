import type { Metadata } from "next";
import Link from "next/link";
import { serverApi } from "@/lib/server-api";
import { dateTr } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Blog | almakisterim.com",
  description: "Alım-satım rehberleri, güvenli alışveriş ipuçları ve almakisterim'den haberler.",
};

type Item = { slug: string; title: string; summary: string; published_at: string };

export default async function BlogList() {
  const data = await serverApi<{ items: Item[] }>("/blog");
  const items = data?.items ?? [];
  return (
    <div className="wrap" style={{ maxWidth: 860, paddingBottom: 40 }}>
      <div className="crumb"><Link href="/">Ana Sayfa</Link> › Blog</div>
      <div className="list-head"><h1>Blog</h1></div>
      {!items.length ? <div className="box"><div className="empty">Yakında burada alım-satım rehberleri olacak.</div></div> : (
        <div className="blog-list">{items.map((p) => (
          <Link key={p.slug} href={`/blog/${p.slug}`} className="blog-card">
            <h2>{p.title}</h2>
            {p.summary && <p>{p.summary}</p>}
            <small>{dateTr(p.published_at)}</small>
          </Link>
        ))}</div>
      )}
    </div>
  );
}
