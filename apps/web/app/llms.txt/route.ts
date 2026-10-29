import { alimTalepleri, ilPath, locative, SITE_URL } from "@/lib/seo";
import { serverApi, siteData } from "@/lib/server-api";

// /llms.txt: yapay zekâ arama motorlarına (ChatGPT, Perplexity, Gemini…) sitenin ne olduğu ve önemli sayfaları, düz metin.
// Biçim: https://llmstxt.org — başlık, kısa özet, bölümler hâlinde bağlantılar.
export const dynamic = "force-dynamic";

type Place = { city: string; top: string | null; sub: string | null; count: number };

export async function GET() {
  const [site, pl, blog] = await Promise.all([
    siteData(),
    serverApi<{ places: Place[]; min: number }>("/seo/places"),
    serverApi<{ items: { slug: string; title: string; summary: string }[] }>("/blog"),
  ]);
  const u = (p: string) => `${SITE_URL}${p}`;
  const tops = site?.categories ?? [];
  const cities = (pl?.places ?? []).filter((p) => !p.top && p.count >= pl!.min).slice(0, 20);
  const lines = [
    "# almakisterim.com",
    "",
    "> Türkiye'nin alım talebi sitesi. Alıcı ne almak istediğini (araç, ev, telefon, eşya, hizmet…) bütçesiyle birlikte ücretsiz yazar; elinde uygun ürün olan satıcılar alıcıya ulaşır. İlan aramak yerine talep verilir.",
    "",
    "Nasıl çalışır: 1) Alıcı talebini tek cümleyle yazar, yapay zekâ formu doldurur. 2) Talep denetlenip yayına çıkar. 3) Satıcılar talebi görür, alıcının numarasını açıp arar ya da mesaj atar. Satıcılar il ve kategoriye göre talep alarmı kurup yeni talepten anında haberdar olur. Alıcının numarası herkese açık değildir; yalnızca sınırlı sayıda satıcı görebilir.",
    "",
    "## Ana sayfalar",
    `- [Ücretsiz alım talebi ver](${u("/talep-ver")}): Ne almak istediğinizi yazın.`,
    `- [Tüm alım talepleri](${u("/kategori")}): Alıcıların güncel talepleri, kategori ve ile göre süzülebilir.`,
    `- [Sık sorulan sorular](${u("/sss")})`,
    `- [Blog](${u("/blog")}): Alım-satım rehberleri.`,
    "",
    "## Kategoriler",
    ...tops.map((t) => `- [${alimTalepleri(t.name)}](${u(`/kategori/${t.id}`)})${t.subs.length ? `: ${t.subs.map((s) => s.name).join(", ")}` : ""}`),
    ...(cities.length ? ["", "## İllere göre talepler", ...cities.map((p) => `- [${locative(p.city)} alım talepleri](${u(ilPath(p.city))}): ${p.count} açık talep`)] : []),
    ...(blog?.items.length ? ["", "## Rehberler", ...blog.items.slice(0, 30).map((b) => `- [${b.title}](${u(`/blog/${b.slug}`)})${b.summary ? `: ${b.summary}` : ""}`)] : []),
    "",
    "## Optional",
    `- [Sözleşmeler ve kurallar](${u("/sozlesmeler")})`,
    `- [Site haritası](${u("/sitemap.xml")})`,
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
