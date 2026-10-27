// Alt bilgi yönetimden düzenlenir (Yönetim → Alt Bilgi ve Sayfalar) ve /categories ile gelir.
// Sunucudan gelene kadar aynı varsayılan gösterilir (apps/api/src/modules/site.ts → DEFAULT_FOOTER).
export type Footer = { columns: { title: string; links: { label: string; href: string }[] }[]; bottom_left: string; bottom_right: string };
export const DEFAULT_FOOTER: Footer = {
  columns: [
    { title: "Kurumsal", links: [{ label: "Hakkımızda", href: "/sayfa/hakkimizda" }, { label: "Sık Sorulan Sorular", href: "/sss" }, { label: "İletişim", href: "/sayfa/iletisim" }, { label: "Blog", href: "/blog" }, { label: "Güvenli Al", href: "/guvenli-al" }] },
    { title: "Alıcılar İçin", links: [{ label: "Ücretsiz Talep Ver", href: "/talep-ver" }, { label: "Tüm Talepler", href: "/kategori" }, { label: "Güvenli Alışveriş İpuçları", href: "/sozlesmeler/guvenli-alisveris" }] },
    { title: "Satıcılar İçin", links: [{ label: "Size Uygun Talepler", href: "/bana-ozel?s=eslesme" }, { label: "Kredi ve Mağaza", href: "/bana-ozel?s=kredi" }, { label: "Talep Alarmları", href: "/bana-ozel?s=alarm" }] },
    { title: "Gizlilik ve Kullanım", links: [{ label: "Sözleşmeler ve Kurallar", href: "/sozlesmeler" }, { label: "Üyelik Sözleşmesi", href: "/sozlesmeler/uyelik-sozlesmesi" }, { label: "KVKK Aydınlatma Metni", href: "/sozlesmeler/kvkk-aydinlatma-metni" }, { label: "Çerez Politikası", href: "/sozlesmeler/cerez-politikasi" }, { label: "Hesap Silme", href: "/sozlesmeler/hesap-silme" }] },
  ],
  bottom_left: "© {yıl} almakisterim.com",
  bottom_right: "Numaranız yalnızca talebinizle ilgilenen sınırlı sayıda satıcıya açılır.",
};
export const withYear = (s: string) => s.replace(/\{yıl\}/g, String(new Date().getFullYear()));
