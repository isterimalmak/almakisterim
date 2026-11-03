import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingView, type LandingStats, type LinkGroup } from "@/components/LandingView";
import type { RequestItem } from "@/lib/api";
import { LANDINGS } from "@/lib/landing";
import { PRODUCT_MODELS } from "@/lib/products";
import { OG_BASE, ogImage, slugify } from "@/lib/seo";
import { serverApi } from "@/lib/server-api";

// Marka ve model alıcı sayfaları (sahibinden'deki marka/model sayfaları gibi, ama satıcı için):
// /alicilar, /alicilar/arac/volkswagen, /alicilar/arac/volkswagen/passat, /alicilar/telefon/apple/iphone-15.
// Marka ve model adları kataloglardan gelir; katalogda olmayan adres 404 olur.
export const dynamic = "force-dynamic";

type P = { params: Promise<{ p?: string[] }> };
type Kind = "arac" | "telefon";
const KINDS: Record<Kind, { label: string; n: string; acc: (x: string) => string; hub: string }> = {
  arac: { label: "Araç", n: "araç", acc: (x) => `${x} aracınızı`, hub: "arabami-satmak-istiyorum" },
  telefon: { label: "Telefon", n: "telefon", acc: (x) => `${x} telefonunuzu`, hub: "telefonumu-satmak-istiyorum" },
};

async function catalog(kind: Kind): Promise<Record<string, string[]>> {
  if (kind === "telefon") return PRODUCT_MODELS.telefon ?? {};
  return (await serverApi<{ cars: Record<string, string[]> }>("/catalog/vehicles"))?.cars ?? {};
}

async function resolve(parts: string[] = []) {
  const [k, b, m] = parts.map((x) => decodeURIComponent(x));
  if (!k) return { index: true as const };
  if (k !== "arac" && k !== "telefon") return null;
  const kind = k as Kind;
  const cat = await catalog(kind);
  if (!b) return { kind, cat };
  const brand = Object.keys(cat).find((x) => slugify(x) === b);
  if (!brand || parts.length > 3) return null;
  // Telefon modelleri markayı içerebilir ("Realme 12"); adres modelin kendi adından kurulur.
  const model = m ? cat[brand]!.find((x) => slugify(x) === m) : undefined;
  if (m && !model) return null;
  return { kind, cat, brand, model };
}
type R = NonNullable<Awaited<ReturnType<typeof resolve>>>;

const fullName = (brand: string, model?: string) => (model ? (model.toLocaleLowerCase("tr").startsWith(brand.toLocaleLowerCase("tr")) ? model : `${brand} ${model}`) : brand);
const pathOf = (kind?: Kind, brand?: string, model?: string) =>
  ["/alicilar", kind, brand && slugify(brand), model && slugify(model)].filter(Boolean).join("/");
const query = (kind: Kind, brand?: string, model?: string) => new URLSearchParams(kind === "arac"
  ? { top: "vasita", ...(brand ? { arac_marka: brand } : {}), ...(model ? { arac_model: model } : {}) }
  : { top: "elektronik", sub: "telefon", ...(brand ? { a_marka: brand } : {}), ...(model ? { a_model: model } : {}) });

function texts(r: R) {
  if ("index" in r) return { h1: "Alıcılar: Marka ve Modele Göre Alım Talepleri", title: "Alıcılar – Marka ve Modele Göre Almak İsteyenler", description: "Araç ve telefon alıcıları marka ve modele göre: kim, hangi bütçeyle, hangi ilde almak istiyor? Elinizdekini doğrudan alıcıya satın." };
  const K = KINDS[r.kind];
  if (!r.brand) return { h1: `${K.label} Alıcıları: Markaya Göre`, title: `${K.label} Alanlar – Markaya Göre ${K.label} Almak İsteyenler`, description: `${K.label} almak isteyen alıcılar markaya göre. Markanızı seçin, ${K.n} almak isteyenlerin bütçesini ve ilini görün, doğrudan satın.` };
  const name = fullName(r.brand, r.model);
  return {
    h1: `${name} Alıcıları`,
    title: `${name} Alıcıları – ${name} Satmak İsteyenler İçin Alım Talepleri`,
    description: `${name} almak isteyen alıcıların güncel talepleri: bütçe, il${r.kind === "arac" ? ", yıl ve kilometre" : " ve hafıza"}. ${K.acc(name)} ilan vermeden doğrudan alıcıya satın.`,
  };
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const r = await resolve((await params).p);
  if (!r) return { title: "Sayfa bulunamadı", robots: { index: false, follow: true } };
  const t = texts(r);
  const path = "index" in r ? "/alicilar" : pathOf(r.kind, r.brand, r.model);
  return {
    title: { absolute: `${t.title} | almakisterim.com` }, description: t.description,
    alternates: { canonical: path },
    openGraph: { ...OG_BASE, title: t.title, description: t.description, url: path, images: ogImage("kategori", "index" in r || r.kind === "arac" ? "vasita" : "elektronik") },
  };
}

export default async function Alicilar({ params }: P) {
  const r = await resolve((await params).p);
  if (!r) notFound();
  const t = texts(r);
  const crumbs = [{ name: "Ana Sayfa", path: "/" }, { name: "Alıcılar", path: "/alicilar" }];

  if ("index" in r) {
    const [cars, phones] = [await catalog("arac"), await catalog("telefon")];
    return (
      <LandingView crumbs={crumbs} h1={t.h1} kind="sat" n="ürün" acc="ürününüzü"
        intro={["Elinizdeki aracı ya da telefonu kime satacağınızı bilmiyorsanız markasını seçin: o markayı almak isteyen alıcıların bütçesini, ilini ve isteklerini görün.", "Burada ilanı alıcı verir; siz uygun alıcıya doğrudan ulaşırsınız."]}
        stats={await serverApi<LandingStats>("/seo/stats")} items={(await serverApi<{ items: RequestItem[] }>("/requests?per=12"))?.items ?? []}
        listHref="/kategori" talepHref="/talep-ver" faq={[]}
        groups={[
          { title: "Araç markaları", links: Object.keys(cars).map((b) => ({ href: pathOf("arac", b), label: `${b} alıcıları` })) },
          { title: "Telefon markaları", links: Object.keys(phones).map((b) => ({ href: pathOf("telefon", b), label: `${b} alıcıları` })) },
          { title: "Çok aranan sayfalar", links: LANDINGS.map((l) => ({ href: `/${l.slug}`, label: l.h1 })) },
        ]} />
    );
  }

  const K = KINDS[r.kind];
  const name = r.brand ? fullName(r.brand, r.model) : K.label;
  const q = query(r.kind, r.brand, r.model);
  const [stats, list] = await Promise.all([serverApi<LandingStats>(`/seo/stats?${q}`), serverApi<{ items: RequestItem[] }>(`/requests?${q}&per=12`)]);
  if (r.brand) crumbs.push({ name: K.label, path: pathOf(r.kind) }, { name: r.brand, path: pathOf(r.kind, r.brand) });
  else crumbs.push({ name: K.label, path: pathOf(r.kind) });
  if (r.model) crumbs.push({ name: r.model, path: pathOf(r.kind, r.brand, r.model) });
  const models = r.brand ? r.cat[r.brand]! : [];
  const groups: LinkGroup[] = [
    ...(r.brand && !r.model ? [{ title: `${r.brand} modellerine göre alıcılar`, links: models.map((m) => ({ href: pathOf(r.kind, r.brand, m), label: fullName(r.brand!, m) })) }] : []),
    ...(r.model ? [{ title: `Diğer ${r.brand} modelleri`, links: models.filter((m) => m !== r.model).map((m) => ({ href: pathOf(r.kind, r.brand, m), label: fullName(r.brand!, m) })) }] : []),
    { title: r.brand ? `Diğer ${K.n} markaları` : `${K.label} markaları`, links: Object.keys(r.cat).filter((b) => b !== r.brand).map((b) => ({ href: pathOf(r.kind, b), label: `${b} alıcıları` })) },
    { title: "Almak mı istiyorsunuz?", links: [{ href: `/talep-ver?metin=${encodeURIComponent(`${name} almak istiyorum, `)}`, label: `${name} almak istiyorum – ücretsiz talep ver` }] },
    { title: "Çok aranan sayfalar", links: LANDINGS.filter((l) => l.brands === r.kind).map((l) => ({ href: `/${l.slug}`, label: l.h1 })) },
  ];
  const acc = K.acc(name);
  const faq: [string, string][] = [
    [`${acc} kime satabilirim?`, `almakisterim.com'da ${name} almak isteyen alıcılar bütçesini ve ilini yazar. ${acc} bir talebe uyuyorsa alıcıya doğrudan ulaşır, aracısız satarsınız.`],
    [`Şu an kaç kişi ${name} almak istiyor?`, stats?.count ? `Şu an ${stats.count} açık talep var${stats.avg_budget ? `; ortalama bütçe ${stats.avg_budget.toLocaleString("tr-TR")} TL` : ""}. Sayı her gün değişir; alarm kurarsanız yeni talepleri ilk siz görürsünüz.` : `Şu an açık talep yok. ${name} için alarm kurun; almak isteyen biri talep verdiği anda size haber verelim.`],
    [`${name} için ilan vermem gerekir mi?`, `Hayır. Burada ilanı alıcı verir; siz yalnızca ${name} arayan alıcıların taleplerine bakarsınız. Üyelik ücretsizdir.`],
    [`${name} satarken nelere dikkat etmeliyim?`, r.kind === "arac"
      ? "Kapora istemeyin ve göndermeyin; ödemeyi noterde, devir sırasında alın. Hasar kaydını ve tramer tutarını alıcıya açıkça söyleyin."
      : "Satıştan önce hesabınızdan çıkış yapın (iCloud / Google), cihazı sıfırlayın. Ödemeyi elden teslimde alın; kargolu satışta Güvenli Al'ı kullanın."],
  ];
  const intro = [
    `${name} satmak istiyorsanız, ${name} almak isteyen alıcıların kendi yazdığı taleplere bakın. Her talepte bütçe, il${r.kind === "arac" ? ", yıl ve kilometre aralığı" : ", hafıza ve garanti isteği"} yazar.`,
    stats?.count
      ? `Şu an ${stats.count} alıcı ${name} arıyor${stats.cities.length ? `; en çok ${stats.cities.slice(0, 3).map((c) => c.city).join(", ")} illerinde` : ""}. Uygun talebi açın, alıcıyla doğrudan görüşün.`
      : `Şu an açık ${name} talebi yok; alarm kurarsanız almak isteyen biri talep verdiği anda size haber veririz.`,
  ];
  return (
    <LandingView crumbs={crumbs} h1={t.h1} intro={intro} kind="sat" n={r.brand ? name : K.n} acc={acc}
      stats={stats} items={list?.items ?? []} listHref={`/kategori/${r.kind === "arac" ? "vasita" : "elektronik/telefon"}`}
      talepHref={`/talep-ver?metin=${encodeURIComponent(`${name} almak istiyorum, `)}`} faq={faq} groups={groups} />
  );
}
