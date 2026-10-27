import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

// Kurumsal sayfalar. Sözleşme ve politika metinleri /sozlesmeler altında (sunucudan gelir).
const PAGES: Record<string, { title: string; body: string[] }> = {
  hakkimizda: { title: "Hakkımızda", body: ["almakisterim.com, alıcıların ne almak istediklerini yazdığı ve satıcıların bu talepleri görüp alıcıya telefonla veya mesajla ulaştığı bir tersine pazaryeridir.", "Alıcılar için talep vermek ücretsizdir. Satıcılar uygun alıcıları listeler; arar veya mesaj atar."] },
  iletisim: { title: "İletişim", body: ["Soru ve önerileriniz için: destek@almakisterim.com"] },
};

// Eski adresler: sözleşme ve politika metinleri artık /sozlesmeler altında, tam hâliyle.
const MOVED: Record<string, string> = {
  "kullanim-kosullari": "uyelik-sozlesmesi", kvkk: "kvkk-aydinlatma-metni", cerez: "cerez-politikasi",
  "hesap-silme": "hesap-silme", "guvenli-alisveris": "guvenli-alisveris",
};

export function generateStaticParams() {
  return [...Object.keys(PAGES), ...Object.keys(MOVED)].map((slug) => ({ slug }));
}

export default async function StaticPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (MOVED[slug]) permanentRedirect(`/sozlesmeler/${MOVED[slug]}`);
  const p = PAGES[slug];
  if (!p) notFound();
  return (
    <div className="wrap" style={{ maxWidth: 820, paddingBottom: 40 }}>
      <div className="crumb"><Link href="/">Ana Sayfa</Link> › {p.title}</div>
      <div className="box"><div className="box-h"><h1 style={{ fontSize: 18, color: "var(--navy)" }}>{p.title}</h1></div>
        <div className="box-b" style={{ display: "flex", flexDirection: "column", gap: 10, lineHeight: 1.6 }}>{p.body.map((b) => <p key={b}>{b}</p>)}</div>
      </div>
    </div>
  );
}
