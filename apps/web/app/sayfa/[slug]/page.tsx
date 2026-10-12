import Link from "next/link";
import { notFound } from "next/navigation";

// Kurumsal ve yasal sayfalar. KVKK ve kullanım koşulları metinleri yayından önce
// bir hukukçuya kontrol ettirilmelidir; buradakiler taslaktır.
const PAGES: Record<string, { title: string; body: string[] }> = {
  hakkimizda: { title: "Hakkımızda", body: ["almakisterim.com, alıcıların ne almak istediklerini yazdığı ve satıcıların bu taleplere teklif verdiği bir tersine pazaryeridir.", "Alıcılar için talep vermek ücretsizdir. Satıcılar uygun talepleri görür ve en iyi tekliflerini sunar."] },
  iletisim: { title: "İletişim", body: ["Soru ve önerileriniz için: destek@almakisterim.com"] },
  "guvenli-alisveris": { title: "Güvenli Alışveriş İpuçları", body: ["Ürünü görmeden kapora veya ödeme göndermeyin.", "Telefon numaranızı ve kişisel bilgilerinizi ilan metnine yazmayın; iletişim site içinden başlar.", "Şüpheli bir talep veya teklif görürseniz \"Şikayet et\" ile bize bildirin."] },
  "kullanim-kosullari": { title: "Kullanım Koşulları", body: ["Yasaklı ürün ve hizmetler için talep veya teklif verilemez.", "Talep ve teklif metinlerine telefon, e-posta veya bağlantı yazılamaz; yazılırsa otomatik gizlenir.", "Satıcılar alıcının numarasını kredi karşılığı görür; numarayı yalnızca ilgili talep için kullanabilir. Alıcıyı rahatsız eden veya numarayı başka amaçla kullanan satıcının hesabı kapatılır.", "Gerçek bir alım niyeti taşımayan, yanıltıcı veya ayrımcı içerikler kaldırılır.", "almakisterim.com alıcı ile satıcı arasındaki alışverişin tarafı değildir."] },
  kvkk: { title: "KVKK Aydınlatma Metni", body: ["Üyelik için telefon numaranız veya e-posta adresiniz ile adınız işlenir. Bu bilgiler giriş, bildirim ve güvenlik amacıyla kullanılır.", "Alım talebi verdiğinizde, açık rızanızla telefon numaranız yalnızca o talep için ücret ödeyen sınırlı sayıda satıcıyla paylaşılır; satıcılar sizi bu talep hakkında arayabilir. Numaranızı kimlerin gördüğünü talep sayfanızda görürsünüz; talebi kapattığınızda numaranız yeni satıcılara gösterilmez. E-posta adresiniz satıcılarla paylaşılmaz.", "Verileriniz Avrupa Birliği'ndeki (Frankfurt) sunucularda saklanır.", "Bilgilerinizin silinmesi için destek@almakisterim.com adresine yazabilirsiniz."] },
  cerez: { title: "Çerez Politikası", body: ["Yalnızca oturumunuzu açık tutmak için zorunlu bir çerez kullanılır. Reklam veya izleme çerezi kullanılmaz."] },
};

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

export default async function StaticPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
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
