import type { Attr } from "../data/attrs.js";

// Talep metninden kategoriye özel alanları (oda sayısı, m², imar, tapu, hafıza, numara…) doldurur.
// Yapay zekânın önerdiği değerler katalogdaki seçeneklerle doğrulanır; boş kalanlar metinden kurallarla bulunur.
// Yalnızca kişinin yazdığı bilgiler doldurulur; tahmin edilen ya da uydurulan değer konmaz.

const fold = (s: string) => s.toLocaleLowerCase("tr").replace(/\s+/g, " ").trim();
const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const L = "a-z0-9ığüşöçâîû";
const hasWord = (t: string, w: string) => new RegExp(`(^|[^${L}])${esc(fold(w))}(?=[^${L}]|$)`).test(t);
// "Konut imarlı", "eşyalı", "hisseli" gibi ekli yazımlar da eşleşsin (sözcük başı sınırı yeterli).
const hasStem = (t: string, w: string) => new RegExp(`(^|[^${L}])${esc(fold(w))}`).test(t);

// Seçenek adının metinde başka yazımları.
const SYN: Record<string, string[]> = {
  "Apple": ["iphone", "ipad", "macbook", "imac", "apple"], "Samsung": ["samsung", "galaxy"], "Xiaomi": ["xiaomi", "redmi", "poco"],
  "Müstakil tapu": ["müstakil tapu", "tek tapu", "müstakil tapulu"], "Hisseli tapu": ["hisseli"],
  "Bağ & Bahçe": ["bağ", "bahçe"], "Dükkan & Mağaza": ["dükkan", "mağaza"], "Fabrika & Atölye": ["fabrika", "atölye"], "Plaza katı": ["plaza"],
  "Merkezi": ["merkezi ısıtma", "merkezi sistem", "merkezi kalorifer", "kalorifer"], "Yerden ısıtma": ["yerden ısıtma"],
  "Eşyalı": ["eşyalı"], "Eşyasız": ["eşyasız", "boş daire", "boş ev"],
  "Kadın": ["kadın", "bayan"], "Erkek": ["erkek", "bay"], "Çocuk": ["çocuk"], "Unisex": ["unisex"],
  "PlayStation 5": ["ps5", "playstation 5"], "PlayStation 4": ["ps4", "playstation 4"], "Xbox Series X/S": ["xbox"], "Nintendo Switch": ["switch", "nintendo"],
  "Dizüstü": ["dizüstü", "laptop", "notebook", "macbook"], "Masaüstü": ["masaüstü"], "Hepsi bir arada": ["hepsi bir arada", "imac"],
  "Akıllı saat": ["akıllı saat", "smartwatch", "apple watch"], "Kol saati": ["kol saati"],
  "Koltuk takımı": ["koltuk"], "Yatak & Baza": ["yatak", "baza"], "Yemek masası": ["yemek masası"], "Gardırop": ["gardırop", "dolap"],
  "Çamaşır makinesi": ["çamaşır makinesi"], "Bulaşık makinesi": ["bulaşık makinesi"], "Kurutma makinesi": ["kurutma makinesi"],
  "Sürat teknesi": ["sürat teknesi"], "Jet Ski": ["jet ski", "jetski"], "Şişme bot": ["şişme bot"],
  "Ekskavatör": ["ekskavatör", "ekskavator"], "Kazıcı yükleyici": ["kazıcı yükleyici", "beko loder", "jcb"],
  "Var": ["garantili", "garantisi olsun", "garanti olsun", "garantisi devam"],
};
// Bu seçenekler ancak ilgili sözcük yanında geçerse sayılır ("yol" → yol bisikleti, "Ofis" bilgisayar değil işyeri).
const STRICT: Record<string, RegExp> = {
  "Yol": /yol bisiklet/, "Şehir": /şehir bisiklet/, "Dağ": /dağ bisiklet/, "Elektrikli": /elektrikli bisiklet/,
  "Tekne": /(^|[^a-zığüşöç])tekne(?!si)/, "Fırın": /(^|[^a-zığüşöç])fırın/,
};

function pickOption(t: string, a: Attr): string | null {
  for (const o of a.o ?? []) {
    if (o === "Farketmez") continue;
    if (STRICT[o]) { if (STRICT[o]!.test(t)) return o; continue; }
    const words = SYN[o] ?? [o];
    if (words.some((w) => (w.length <= 3 ? hasWord(t, w) : hasStem(t, w)))) return o;
  }
  return null;
}

const int = (s: string) => Math.round(parseFloat(s.replace(/\./g, "").replace(",", ".")));

function fromText(t: string, a: Attr): string | number | null {
  let m: RegExpExecArray | null;
  switch (a.k) {
    case "oda": {
      if (/stüdyo|1\s*\+\s*0/.test(t)) return "1+0";
      if (!(m = /(\d)\s*\+\s*(\d)/.exec(t))) return null;
      const n = Number(m[1]);
      return n >= 4 ? "4+1 ve üzeri" : n >= 1 ? `${n}+1` : null;
    }
    case "m2": return (m = /(\d[\d.]*)\s*(?:m2|m²|metrekare|metre kare|metrekarelik)/.exec(t)) ? int(m[1]!) : null;
    case "bina_yasi": return (m = /(\d{1,2})\s*yaş/.exec(t)) ? Number(m[1]) : /sıfır bina|yeni bina|yeni yapı/.test(t) ? 0 : null;
    case "kisi": return (m = /(\d{1,2})\s*kişi/.exec(t)) ? Number(m[1]) : null;
    case "numara": return (m = /(\d{2})\s*numara|numara\s*(\d{2})/.exec(t)) ? Number(m[1] ?? m[2]) : null;
    case "boy": return (m = /(\d{1,3}(?:[.,]\d)?)\s*(?:metre|m)(?![²2a-zığüşöç])/.exec(t)) ? Math.round(parseFloat(m[1]!.replace(",", "."))) : null;
    case "yil": return (m = /\b((?:19|20)\d{2})\b/.exec(t)) ? Number(m[1]) : null;
    case "hafiza": {
      if (/1\s*tb|2\s*tb/.test(t)) return "1 TB+";
      if (!(m = /(\d{2,3})\s*gb(?!\s*ram)/.exec(t))) return null;
      const v = `${m[1]} GB`;
      return a.o?.includes(v) ? v : null;
    }
    case "ram": {
      if (!(m = /(\d{1,2})\s*gb/.exec(t))) return null;
      const n = Number(m[1]);
      return n >= 32 ? "32 GB ve üzeri" : n >= 16 ? "16 GB" : n >= 8 ? "8 GB" : null;
    }
    case "ekran": {
      if (!(m = /(\d{2})\s*(?:inç|inch|ekran|")/.exec(t))) return null;
      const n = Number(m[1]);
      return n >= 65 ? "65 inç ve üzeri" : n >= 50 ? "50-55 inç" : n >= 32 ? "32-43 inç" : null;
    }
    case "beden": return (m = /\b(xxl|xl|xs|s|m|l)\s*beden|beden\s*:?\s*(xxl|xl|xs|s|m|l)\b/.exec(t)) ? (((x) => x === "XXL" ? "XXL ve üzeri" : x)((m[1] ?? m[2])!.toUpperCase())) : null;
    case "jant": return (m = /(\d{2}(?:[.,]5)?)\s*jant|jant\s*(\d{2}(?:[.,]5)?)/.exec(t)) ? (((v) => (a.o?.includes(v) ? v : null))((m[1] ?? m[2])!.replace(",", "."))) : null;
    default: return a.t === "sel" ? pickOption(t, a) : null;
  }
}

// Yapay zekânın verdiği değeri katalogla doğrular: seçenek birebir (büyük/küçük harf duyarsız), sayı makul aralıkta.
function validValue(a: Attr, v: unknown): string | number | null {
  if (v === null || v === undefined || v === "") return null;
  if (a.t === "num") {
    const n = typeof v === "number" ? v : int(String(v).replace(/[^\d.,]/g, ""));
    const max = a.k === "yil" ? 2100 : a.k === "m2" ? 10_000_000 : 1000;
    return Number.isFinite(n) && n >= 0 && n <= max && (a.k !== "yil" || n >= 1950) ? Math.round(n) : null;
  }
  const s = fold(String(v));
  return a.o?.find((o) => fold(o) === s) ?? null;
}

export function fillAttrs(text: string, schema: Attr[], suggested: Record<string, unknown>): Record<string, string | number> {
  const t = fold(text);
  const out: Record<string, string | number> = {};
  for (const a of schema) {
    const v = validValue(a, suggested[a.k]) ?? fromText(t, a);
    if (v !== null) out[a.k] = v;
  }
  return out;
}

// Yapay zekâya gönderilen kısa katalog: "arsa: m2 (sayı) | imar [Konut, Ticari, …] | tapu […]".
export function describeAttrs(schema: Attr[]) {
  return schema.map((a) => (a.t === "num" ? `${a.k} (${a.l}, sayı)` : `${a.k} (${a.l}) [${(a.o ?? []).join(", ")}]`)).join(" | ");
}
