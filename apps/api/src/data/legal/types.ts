// Sözleşme ve politika metinleri. Metinler sitenin gerçek işleyişine göre yazılmıştır; yayından önce bir hukukçuya
// kontrol ettirilmelidir. {{UNVAN}} gibi yer tutucular Yönetim → Ayarlar → Şirket bilgilerinden, {{GA_...}} gibi
// olanlar Güvenli Al ayarlarından doldurulur (modules/legal.ts).
// Metinde esaslı bir değişiklik yapıldığında sürüm artırılır; onay gerektiren metinlerde üyelerden yeniden onay istenir.
export type LegalSection = { h: string; p: string[] };
export type LegalDoc = {
  slug: string;
  title: string;
  summary: string;
  version: string;
  effective: string;
  // Üyenin onay vermesi gereken metin: onay sürümüyle birlikte kaydedilir (consents tablosu).
  consent?: boolean;
  sections: LegalSection[];
};
