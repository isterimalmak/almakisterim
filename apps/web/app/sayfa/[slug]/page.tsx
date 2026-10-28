import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Corporate } from "@/components/Corporate";
import { Markdown } from "@/components/Markdown";
import { serverApi } from "@/lib/server-api";
import { snippet } from "@/lib/seo";

// Kurumsal sayfalar (Hakkımızda, İletişim ve yöneticinin eklediği diğerleri): Yönetim → Alt Bilgi ve Sayfalar.
// Sözleşme ve politika metinleri /sozlesmeler altında.
export const dynamic = "force-dynamic";
type Page = { slug: string; title: string; body: string };
type Company = Partial<Record<"marka" | "unvan" | "sorumlu" | "sicil" | "kep" | "mersis" | "vergi" | "adres" | "telefon" | "eposta", string>>;

// Eski adresler: sözleşme ve politika metinleri artık /sozlesmeler altında, tam hâliyle.
const MOVED: Record<string, string> = {
  "kullanim-kosullari": "uyelik-sozlesmesi", kvkk: "kvkk-aydinlatma-metni", cerez: "cerez-politikasi",
  "hesap-silme": "hesap-silme", "guvenli-alisveris": "guvenli-alisveris",
};
const load = async (slug: string) => (await serverApi<{ page: Page }>(`/pages/${encodeURIComponent(slug)}`))?.page ?? null;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = MOVED[(await params).slug] ? null : await load((await params).slug);
  return p ? { title: p.title, description: snippet(p.body.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[#*_>]/g, " ")), alternates: { canonical: `/sayfa/${p.slug}` } } : { title: "Sayfa" };
}

// İletişim: şirket bilgileri tablosu (Yönetim → Sözleşmeler → Şirket bilgileri) ve adres haritası.
async function ContactTable() {
  const c = (await serverApi<{ company: Company }>("/company"))?.company ?? {};
  const rows: [string, React.ReactNode][] = [];
  const add = (label: string, v: string | undefined, node?: React.ReactNode) => { if (v) rows.push([label, node ?? v]); };
  add("İşletme Adı / Tescilli Markası", c.marka);
  add("Ticaret Ünvanı", c.unvan);
  add("Sorumlu Kişi", c.sorumlu);
  add("Ticaret Sicil No", c.sicil);
  add("KEP Adresi", c.kep, <a className="link" href={`mailto:${c.kep}`}>{c.kep}</a>);
  add("MERSİS Numarası", c.mersis);
  add("Vergi Dairesi / No", c.vergi);
  add("Merkez Ofis", c.adres, <span style={{ whiteSpace: "pre-line" }}>{c.adres}</span>);
  add("Çağrı Merkezi", c.telefon, <a className="link" href={`tel:${c.telefon?.replace(/[^\d+]/g, "")}`}>{c.telefon}</a>);
  add("E-posta", c.eposta, <a className="link" href={`mailto:${c.eposta}`}>{c.eposta}</a>);
  rows.push(["Destek Merkezi", <Link key="d" className="link" href="/sss">almakisterim.com/sss</Link>]);
  return (
    <>
      <table className="corp-table"><tbody>{rows.map(([l, v]) => <tr key={l}><th scope="row">{l}</th><td>{v}</td></tr>)}</tbody></table>
      {c.adres && (
        <div className="corp-map">
          <iframe title="Merkez ofis haritası" loading="lazy" referrerPolicy="no-referrer-when-downgrade"
            src={`https://maps.google.com/maps?q=${encodeURIComponent(c.adres)}&z=15&output=embed`} />
        </div>
      )}
    </>
  );
}

export default async function StaticPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (MOVED[slug]) permanentRedirect(`/sozlesmeler/${MOVED[slug]}`);
  const p = await load(slug);
  if (!p) notFound();
  return (
    <Corporate active={`/sayfa/${slug}`} title={p.title}>
      {slug === "iletisim" && <ContactTable />}
      {p.body.trim() && <div className="corp-text"><Markdown text={p.body} /></div>}
    </Corporate>
  );
}
