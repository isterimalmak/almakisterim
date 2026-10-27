// Sözleşme ve politika metinleri sunucudan gelir (apps/api/src/data/legal); burada yalnızca türler ve gruplar.
export type LegalItem = { slug: string; title: string; summary: string; version: string; effective: string };
export type LegalDoc = LegalItem & { consent?: boolean; sections: { h: string; p: string[] }[] };

// Sözleşmeler ve Kurallar sayfasındaki gruplar.
export const LEGAL_GROUPS: { title: string; slugs: string[] }[] = [
  { title: "Üyelik ve Kurallar", slugs: ["uyelik-sozlesmesi", "talep-verme-kurallari", "yasakli-urunler", "satici-kurallari"] },
  { title: "Ödeme ve Satın Alma", slugs: ["guvenli-al-sozlesmesi", "on-bilgilendirme-formu", "mesafeli-satis-sozlesmesi"] },
  { title: "Kişisel Veriler ve Gizlilik", slugs: ["kvkk-aydinlatma-metni", "acik-riza-metni", "ticari-elektronik-ileti-onayi", "cerez-politikasi", "kvkk-basvuru-formu"] },
  { title: "Diğer", slugs: ["hak-ihlali-bildirimi", "hesap-silme", "guvenli-alisveris"] },
];

export const dateLong = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
