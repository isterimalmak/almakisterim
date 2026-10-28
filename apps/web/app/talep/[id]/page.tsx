import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RequestView, type RequestData } from "@/components/RequestView";
import { budgetTxt } from "@/lib/format";
import Link from "next/link";
import { ilPath, ldJson, locative, OG_BASE, ogImage, SITE_URL, snippet, talepId, talepPath } from "@/lib/seo";
import { serverApi } from "@/lib/server-api";

// Talep sayfası sunucuda hazırlanır: her talebin kendi başlığı, açıklaması ve asıl adresi olur.
// Adres: /talep/1048231-bmw-3-serisi-araniyor-istanbul (eski /talep/1048231 da açılır, asıl adres bildirilir).
export const dynamic = "force-dynamic";

const load = (id: number) => serverApi<RequestData>(`/requests/${id}`);
// lib/locations tarayıcı dosyası olduğu için konum yazısı burada kurulur.
const placeTxt = (r: { city: string; district?: string; neighbourhood?: string }) => [r.city, r.district, r.neighbourhood].filter(Boolean).join(" / ");
const isOpen = (r: RequestData["request"]) => r.status === "active" && new Date(r.expires_at) > new Date();

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const id = talepId((await params).id);
  const d = id ? await load(id) : null;
  if (!d) return { title: "Talep bulunamadı", robots: { index: false, follow: true } };
  const r = d.request;
  const place = placeTxt(r);
  const title = `${r.title}${r.city ? ` – ${r.district ? `${r.district}, ` : ""}${r.city}` : ""}`;
  const description = snippet(`${r.category_name} alım talebi${place ? `, ${place}` : ""}. Bütçe: ${budgetTxt(r.budget_min, r.budget_max)}. ${r.description ?? ""}`);
  const image = r.media.find((m) => m.kind === "image")?.url;
  const url = talepPath(r);
  return {
    title, description,
    alternates: { canonical: url },
    // Kapanan talep sayfası durur ama arama sonuçlarından düşer (benzer açık talepler gösterilir).
    robots: isOpen(r) ? undefined : { index: false, follow: true },
    openGraph: { ...OG_BASE, type: "website", title, description, url, images: [...ogImage("talep", r.id), ...(image ? [{ url: image }] : [])] },
  };
}

export default async function TalepPage({ params }: { params: Promise<{ id: string }> }) {
  const id = talepId((await params).id);
  if (!id) notFound();
  const d = await load(id);
  const r = d?.request;
  return (
    <>
      {r && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson({
          "@context": "https://schema.org", "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: r.top_name, item: `${SITE_URL}/kategori/${r.top_id}` },
            { "@type": "ListItem", position: 3, name: r.category_name, item: `${SITE_URL}/kategori/${r.top_id}/${r.category_id}` },
            { "@type": "ListItem", position: 4, name: r.title, item: `${SITE_URL}${talepPath(r)}` },
          ],
        }) }} />
      )}
      <RequestView id={id} initial={d} />
      {r?.city && (
        <nav className="wrap il-more" aria-label="İlgili talepler">
          <Link href={ilPath(r.city, r.top_id, r.category_id)}>{locative(r.city)} diğer {r.category_name} talepleri ›</Link>
          <Link href={ilPath(r.city)}>{locative(r.city)} tüm alım talepleri ›</Link>
        </nav>
      )}
    </>
  );
}
