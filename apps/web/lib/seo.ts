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
