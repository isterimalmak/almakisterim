import type { LegalDoc } from "./types.js";

export const ON_BILGI: LegalDoc = {
  slug: "on-bilgilendirme-formu",
  title: "Ön Bilgilendirme Formu",
  summary: "Kredi paketleri ve ücretli hizmetlerin satın alınmasından önce sunulan yasal ön bilgiler.",
  version: "1.0",
  effective: "2026-10-27",
  consent: true,
  sections: [
    { h: "1. Satıcı (Hizmet Sağlayıcı) Bilgileri", p: [
      "Unvan: {{UNVAN}}",
      "Adres: {{ADRES}}",
      "MERSİS: {{MERSIS}} · Vergi dairesi ve numarası: {{VERGI}}",
      "Telefon: {{TELEFON}} · E-posta: {{EPOSTA}} · KEP: {{KEP}}",
    ] },
    { h: "2. Hizmetin Temel Nitelikleri", p: [
      "Satın alınan hizmet, almakisterim.com'da Satıcı Üyelerin alıcı taleplerine iletişim açma ve Platform'da ilan edilen diğer ücretli hizmetlerde kullanılan Kredi paketi veya mağaza üyeliğidir. Satın alınan paketin adı, içerdiği Kredi miktarı veya üyelik süresi ödeme sayfasında gösterilir.",
      "Krediler ödeme onaylandığı anda Hesabınıza tanımlanır; nakde çevrilemez, devredilemez ve yalnızca Platform'da kullanılabilir. Satın alınan Krediler Hesabınız açık kaldığı sürece süresiz kullanılabilir.",
    ] },
    { h: "3. Fiyat ve Ödeme", p: [
      "Hizmetin tüm vergiler dahil toplam bedeli ödeme sayfasında Türk lirası olarak gösterilir. Ödeme, banka veya kredi kartıyla, lisanslı ödeme kuruluşu iyzico Ödeme Hizmetleri A.Ş. altyapısı üzerinden peşin olarak yapılır. Teslimat masrafı yoktur.",
    ] },
    { h: "4. İfa", p: [
      "Hizmet elektronik ortamda anında ifa edilir: Krediler ödeme onayından hemen sonra Hesabınıza tanımlanır ve Bana Özel → Kredilerim bölümünde görüntülenir. Fatura, Hesabınızda kayıtlı e-posta adresinize elektronik olarak gönderilir.",
    ] },
    { h: "5. Cayma Hakkı", p: [
      "5.1. Mesafeli Sözleşmeler Yönetmeliği'nin 9. maddesi uyarınca, hizmet sözleşmelerinde cayma süresi sözleşmenin kurulduğu gün başlar ve 14 gündür.",
      "5.2. Ancak Yönetmelik'in 15. maddesinin birinci fıkrasının (ğ) bendi uyarınca \"elektronik ortamda anında ifa edilen hizmetler veya tüketiciye anında teslim edilen gayrimaddi mallar\" ile (h) bendi uyarınca \"cayma hakkı süresi sona ermeden önce, tüketicinin onayı ile ifasına başlanan hizmetler\" bakımından cayma hakkı kullanılamaz. Satın alma sırasında, hizmetin anında ifasına başlanmasına onay vermeniz ve bu nedenle cayma hakkınızı kaybedeceğinizi kabul etmeniz istenir.",
      "5.3. Bu kapsamda, satın aldığınız Kredilerin hiçbiri kullanılmamışsa, satın alma tarihinden itibaren 14 gün içinde {{EPOSTA}} adresine yazarak paket bedelinin iadesini talep edebilirsiniz; iade, ödemenin yapıldığı karta 14 gün içinde yapılır. Kredi kullanılmaya başlandıktan sonra kullanılmış kısım için iade yapılmaz.",
    ] },
    { h: "6. Şikâyet ve İtiraz", p: [
      "Şikâyetlerinizi {{EPOSTA}} adresine iletebilirsiniz. Uyuşmazlıklarda, Ticaret Bakanlığı'nca her yıl ilan edilen parasal sınırlar dahilinde yerleşim yerinizdeki veya işlemi yaptığınız yerdeki Tüketici Hakem Heyetine, bu sınırları aşan uyuşmazlıklarda Tüketici Mahkemesine başvurabilirsiniz.",
    ] },
  ],
};

export const MESAFELI: LegalDoc = {
  slug: "mesafeli-satis-sozlesmesi",
  title: "Mesafeli Satış Sözleşmesi",
  summary: "Kredi paketleri ve ücretli hizmetlerin elektronik ortamda satın alınmasına ilişkin sözleşme.",
  version: "1.0",
  effective: "2026-10-27",
  consent: true,
  sections: [
    { h: "Madde 1 – Taraflar", p: [
      "1.1. Satıcı: {{UNVAN}} · Adres: {{ADRES}} · MERSİS: {{MERSIS}} · Vergi dairesi/no: {{VERGI}} · Telefon: {{TELEFON}} · E-posta: {{EPOSTA}} · KEP: {{KEP}} (\"Satıcı\").",
      "1.2. Alıcı: almakisterim.com'da Hesabı bulunan ve ödeme sayfasında satın alma işlemini gerçekleştiren Üye; adı, telefon numarası ve e-posta adresi Hesap bilgilerinde kayıtlı olduğu şekildedir (\"Alıcı\").",
    ] },
    { h: "Madde 2 – Konu", p: [
      "Bu Sözleşme'nin konusu, Alıcı'nın almakisterim.com üzerinden elektronik ortamda siparişini verdiği, nitelikleri ve satış fiyatı ödeme sayfasında ve Ön Bilgilendirme Formu'nda belirtilen Kredi paketi veya ücretli hizmetin satışı ve ifası ile ilgili olarak 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümleri gereğince tarafların hak ve yükümlülüklerinin belirlenmesidir.",
    ] },
    { h: "Madde 3 – Hizmet, Bedel ve Ödeme", p: [
      "3.1. Satın alınan hizmetin adı, içeriği (Kredi miktarı veya üyelik süresi), KDV dahil toplam bedeli ve ödeme şekli, ödeme sayfasında ve siparişin ardından Alıcı'ya gönderilen e-postada yer alır; bu bilgiler Sözleşme'nin ayrılmaz parçasıdır.",
      "3.2. Ödeme, iyzico Ödeme Hizmetleri A.Ş. altyapısı üzerinden banka veya kredi kartıyla peşin olarak yapılır. Kart bilgileri Satıcı tarafından görülmez ve saklanmaz.",
      "3.3. Kartın sahibi olmayan kişilerce yapılan ödemelerde ya da bankanın ödemeyi herhangi bir nedenle Satıcı'ya yapmaması hâlinde, tanımlanan Krediler Alıcı'nın Hesabı'ndan geri alınır.",
    ] },
    { h: "Madde 4 – İfa", p: [
      "4.1. Hizmet, ödemenin onaylanmasıyla birlikte elektronik ortamda anında ifa edilir; Krediler Alıcı'nın Hesabı'na tanımlanır.",
      "4.2. Teknik bir aksaklık nedeniyle Krediler tanımlanamazsa, Alıcı durumu {{EPOSTA}} adresine bildirir; Satıcı Kredileri en geç 3 iş günü içinde tanımlar veya bedeli iade eder.",
    ] },
    { h: "Madde 5 – Cayma Hakkı", p: [
      "5.1. Alıcı, Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesinin birinci fıkrasının (ğ) ve (h) bentleri uyarınca, elektronik ortamda anında ifa edilen ve kendi onayıyla ifasına başlanan bu hizmette cayma hakkının bulunmadığını; satın alma sırasında bu konuda bilgilendirildiğini ve onay verdiğini kabul eder.",
      "5.2. Satıcı, Alıcı lehine olmak üzere, hiç kullanılmamış Kredi paketleri için satın alma tarihinden itibaren 14 gün içinde yapılan iade taleplerini kabul eder. İade, ödemenin yapıldığı karta, talebin Satıcı'ya ulaşmasından itibaren 14 gün içinde yapılır.",
    ] },
    { h: "Madde 6 – Genel Hükümler", p: [
      "6.1. Alıcı, Ön Bilgilendirme Formu'nu okuyup bilgi sahibi olduğunu ve elektronik ortamda gerekli teyidi verdiğini kabul eder.",
      "6.2. Kredilerin kullanımına ilişkin hususlarda Üyelik Sözleşmesi ve Satıcı Kuralları uygulanır.",
      "6.3. Satıcı, bu Sözleşme'yi ve Ön Bilgilendirme Formu'nu Alıcı'nın Hesabı'nda ve e-posta adresine göndererek kalıcı veri saklayıcısıyla Alıcı'ya sunar ve 3 yıl süreyle saklar.",
    ] },
    { h: "Madde 7 – Uyuşmazlık Çözümü", p: [
      "Bu Sözleşme'den doğan uyuşmazlıklarda, Ticaret Bakanlığı'nca ilan edilen parasal sınırlar dahilinde Alıcı'nın yerleşim yerindeki veya işlemin yapıldığı yerdeki Tüketici Hakem Heyetleri, bu sınırları aşan uyuşmazlıklarda Tüketici Mahkemeleri yetkilidir.",
    ] },
    { h: "Madde 8 – Yürürlük", p: [
      "Bu Sözleşme, Alıcı'nın ödeme sayfasında Sözleşme'yi onaylayıp ödemeyi tamamlamasıyla kurulur ve yürürlüğe girer.",
    ] },
  ],
};
