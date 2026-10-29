// Arama motorları: sitenin asıl adresi, okunur talep adresleri ve başlık/açıklama yardımcıları.
export const SITE_URL = (process.env.SITE_URL ?? "https://almakisterim.com").replace(/\/$/, "");

const TR: Record<string, string> = { ç: "c", ğ: "g", ı: "i", İ: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

// "BMW 3 Serisi Alınır, İstanbul" → "bmw-3-serisi-alinir-istanbul"
export function slugify(text: string, max = 70): string {
  const s = text.replace(/[çğıİöşüâîû]/gi, (ch) => TR[ch] ?? TR[ch.toLowerCase()] ?? ch).toLocaleLowerCase("tr")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s.length > max ? s.slice(0, max).replace(/-[^-]*$/, "") || s.slice(0, max) : s;
}

// Talep adresi: /talep/1048231-bmw-3-serisi-araniyor-istanbul. Eski /talep/1048231 adresleri de açılır.
export function talepPath(r: { id: number; title?: string | null; city?: string | null }): string {
  const slug = slugify([r.title, r.city].filter(Boolean).join(" "));
  return slug ? `/talep/${r.id}-${slug}` : `/talep/${r.id}`;
}

// Adresteki "1048231-bmw-..." kısmından talep numarası.
export function talepId(param: string): number | null {
  const m = /^(\d{1,12})(?:-|$)/.exec(decodeURIComponent(param));
  return m ? Number(m[1]) : null;
}

// Açıklama metni: satır sonları ve fazla boşluklar atılır, ~155 karakterde kelime sınırında kesilir.
export function snippet(text: string, max = 155): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

// JSON-LD betiği için güvenli metin (</script> kapanmasın).
export const ldJson = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");

// İl adına bulunma eki: İstanbul'da, İzmir'de, Kars'ta, Bitlis'te.
export function locative(name: string): string {
  const v = [...name.toLocaleLowerCase("tr")].reverse().find((ch) => "aıoueiöü".includes(ch));
  const hard = "fstkçşhp".includes(name.slice(-1).toLocaleLowerCase("tr"));
  return `${name}'${hard ? "t" : "d"}${v && "aıou".includes(v) ? "a" : "e"}`;
}

// İl sayfası adresi: /il/istanbul, /il/istanbul/vasita, /il/istanbul/vasita/otomobil.
export const ilPath = (city: string, top?: string | null, sub?: string | null) =>
  `/il/${slugify(city)}${top ? `/${top}` : ""}${top && sub ? `/${sub}` : ""}`;

// Paylaşım resmi (app/og): /og/talep/1048231 gibi; sayfanın openGraph.images alanına konur.
export const ogImage = (...parts: (string | number | null | undefined)[]) =>
  [{ url: `/og/${parts.filter((x) => x !== null && x !== undefined && x !== "").map((x) => encodeURIComponent(String(x))).join("/")}`, width: 1200, height: 630 }];
// Alt sayfaların openGraph alanı kök ayarın yerine geçer; site adı ve dil her sayfada tekrar verilir.
export const OG_BASE = { siteName: "almakisterim.com", locale: "tr_TR" } as const;

// "Vasıta alım talepleri"; adında zaten "Alım" geçen kategoride tekrar yazılmaz ("Toptan & Kurumsal Alım talepleri").
export const alimTalepleri = (name: string, title = false) =>
  /alım$/i.test(name.trim()) ? `${name} ${title ? "Talepleri" : "talepleri"}` : `${name} ${title ? "Alım Talepleri" : "alım talepleri"}`;
