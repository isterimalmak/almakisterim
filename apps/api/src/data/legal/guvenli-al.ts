import type { LegalDoc } from "./types.js";

export const GUVENLI_AL: LegalDoc = {
  slug: "guvenli-al-sozlesmesi",
  title: "Güvenli Al Hizmet Sözleşmesi",
  summary: "Ödemenin bekletildiği, ürün teslim alınınca satıcıya aktarıldığı Güvenli Al hizmetinin koşulları, ücretleri, süreleri ve iade kuralları.",
  version: "1.0",
  effective: "2026-10-27",
  consent: true,
  sections: [
    { h: "1. Taraflar ve Konu", p: [
      "1.1. Bu Sözleşme, {{UNVAN}} (\"Şirket\") ile Güvenli Al hizmetini kullanan alıcı (\"Alıcı\") ve satıcı (\"Satıcı\") Üyeler arasında, Güvenli Al ile satış başlatıldığı ve ödeme yapıldığı anda elektronik ortamda kurulur. Sözleşme, Üyelik Sözleşmesi'nin tamamlayıcısıdır.",
      "1.2. Güvenli Al; Alıcı'nın, Satıcı ile anlaştığı ürün bedelini lisanslı ödeme kuruluşu iyzico Ödeme Hizmetleri A.Ş. (\"Ödeme Kuruluşu\") altyapısı üzerinden kartla ödediği, ödenen tutarın Alıcı ürünü teslim aldığını onaylayana veya bu Sözleşme'de belirtilen süreler dolana kadar bekletildiği ve ardından Satıcı'ya aktarıldığı bir aracılı ödeme hizmetidir.",
      "1.3. Şirket, Alıcı ile Satıcı arasındaki satış sözleşmesinin tarafı değildir. Ürünün ayıpsız, Talep'e ve Satıcı'nın beyanına uygun olması, faturası, garantisi ve yasal yükümlülükleri Satıcı'ya aittir. Şirket'in yükümlülüğü, ödemenin bu Sözleşme'deki kurallara göre bekletilmesi, Satıcı'ya aktarılması veya Alıcı'ya iade edilmesi ile sınırlıdır.",
    ] },
    { h: "2. Kapsam ve Sınırlar", p: [
      "2.1. Güvenli Al, Platform'da ilan edilen kategorilerde ve tek satışta en fazla {{GA_UST}} TL ürün bedeli için kullanılabilir. Emlak, araç ve hizmet satışları Güvenli Al kapsamında değildir.",
      "2.2. Güvenli Al yalnızca, Satıcı'nın iletişim açtığı bir Talep üzerinden ve iki Üye arasında başlatılabilir. Yasaklı Ürün ve Hizmetler Listesi'ndeki ürünler için Güvenli Al kullanılamaz.",
      "2.3. Satıcı'nın satış başlatabilmesi için Hesabı'na kendi adına kayıtlı geçerli bir Türkiye IBAN'ı eklemiş olması gerekir. IBAN'ın Satıcı'ya ait olmamasından doğan sonuçlardan Satıcı sorumludur.",
    ] },
    { h: "3. Ücretler", p: [
      "3.1. Satıcı'dan, ürün bedeli üzerinden %{{GA_SATICI}} oranında, en az {{GA_MIN}} TL ve en fazla {{GA_MAX}} TL Güvenli Al hizmet komisyonu alınır. Komisyon, Satıcı'ya aktarılacak tutardan düşülür.",
      "3.2. Alıcı'dan, ürün bedeli üzerinden %{{GA_ALICI}} oranında Güvenli Al hizmet bedeli alınır ve ödeme sırasında ürün bedeline eklenerek gösterilir.",
      "3.3. Taksitli ödemelerde Ödeme Kuruluşu ve kart çıkaran banka tarafından uygulanan vade farkı, ödeme sayfasında gösterilir ve Alıcı'ya aittir.",
      "3.4. Ücretlerin güncel hâli Güvenli Al sayfasında ilan edilir; değişiklikler, değişiklikten önce başlatılmış satışları etkilemez. Bütün ücretlere KDV dahildir ve Şirket tarafından fatura düzenlenir.",
    ] },
    { h: "4. İşleyiş", p: [
      "4.1. Satış başlatma: Satıcı, Talep sayfasından ürünü, bedelini ve açıklamasını belirterek Güvenli Al satışı başlatır. Satış teklifi Alıcı'ya bildirilir.",
      "4.2. Ödeme: Alıcı, teslimat bilgilerini (ad-soyad, telefon, il ve açık adres) girerek ödemeyi Ödeme Kuruluşu'nun güvenli ödeme sayfasında yapar. Kart bilgileri Şirket'e iletilmez. Ödeme yapılmayan satış teklifi 7 gün sonra kendiliğinden iptal olur.",
      "4.3. Bekletme: Ödeme tamamlandığında tutar Ödeme Kuruluşu nezdinde bekletilir; Satıcı'ya ödemenin alındığı ve teslimat bilgileri bildirilir. Teslimat bilgileri yalnızca ödeme yapıldıktan sonra ve yalnızca ilgili Satıcı'ya gösterilir.",
      "4.4. Kargolama: Satıcı, ödemenin bildirilmesinden itibaren {{GA_KARGO}} gün içinde ürünü kargoya verir ve kargo firması ile takip numarasını Platform'a girer. Bu süre içinde kargo bilgisi girilmezse satış iptal edilir ve ödenen tutarın tamamı Alıcı'ya iade edilir.",
      "4.5. Teslim ve onay: Alıcı, ürünü teslim aldıktan sonra Talep sayfasından \"Ürünü teslim aldım, sorun yok\" seçeneğiyle onay verir veya bir sorun bildirir. Kargo bilgisinin girildiği tarihten itibaren {{GA_ONAY}} gün içinde onay verilmez ve sorun bildirilmezse, ürün sorunsuz teslim alınmış sayılır ve satış kendiliğinden tamamlanır.",
      "4.6. Ödemenin Satıcı'ya aktarılması: Satış tamamlandığında, ürün bedelinden Satıcı komisyonu düşülerek kalan tutar Satıcı'nın Hesabı'nda kayıtlı IBAN'a en geç 3 iş günü içinde aktarılır. Bankaların çalışma saatleri ve resmî tatiller nedeniyle oluşabilecek gecikmelerden Şirket sorumlu değildir.",
      "4.7. Satışın her aşaması (başlatma, ödeme, kargo, onay, sorun bildirimi, iade, iptal) tarihleriyle birlikte kayıt altına alınır ve taraflara bildirilir.",
    ] },
    { h: "5. İptal", p: [
      "5.1. Ödeme yapılmadan önce Alıcı veya Satıcı satışı dilediği zaman iptal edebilir.",
      "5.2. Ödeme yapıldıktan sonra satış, taraflarca tek taraflı iptal edilemez; ancak Satıcı'nın süresinde kargolamaması, sorun bildirimi veya tarafların birlikte Şirket'e başvurması hâlinde iade süreci işletilir.",
    ] },
    { h: "6. Sorun Bildirimi ve Uyuşmazlık", p: [
      "6.1. Alıcı; ürünün hiç gelmemesi, hasarlı, eksik, ayıplı, sahte gelmesi veya Satıcı'nın beyanından esaslı şekilde farklı olması hâlinde, onay süresi dolmadan Talep sayfasından gerekçesini yazarak sorun bildirir. Sorun bildirilen satışta ödeme, inceleme sonuçlanana kadar bekletilmeye devam eder.",
      "6.2. Şirket, tarafların beyanlarını, mesaj kayıtlarını, kargo kayıtlarını, fotoğraf ve diğer belgeleri inceler; taraflardan ek bilgi ve belge isteyebilir. Taraflar istenen belgeleri 5 iş günü içinde sunmakla yükümlüdür.",
      "6.3. İnceleme sonucunda Şirket; ürünün iadesinin sağlanmasını ve iade kargosunun Satıcı'ya ulaşmasından sonra ödemenin Alıcı'ya iadesini, ödemenin tamamen veya kısmen Alıcı'ya iadesini ya da ödemenin Satıcı'ya aktarılmasını kararlaştırabilir. Şirket'in kararı, tarafların genel hükümlere göre yargı yoluna başvurma hakkını ortadan kaldırmaz.",
      "6.4. Ayıplı ürün nedeniyle iade kararı verilen satışlarda iade kargo bedeli Satıcı'ya aittir. Alıcı'nın haksız sorun bildirdiğinin tespit edilmesi hâlinde ödeme Satıcı'ya aktarılır.",
    ] },
    { h: "7. İade", p: [
      "7.1. İadeler, ödemenin yapıldığı karta Ödeme Kuruluşu aracılığıyla yapılır. İadenin karta yansıma süresi kart çıkaran bankaya bağlıdır.",
      "7.2. Satıcı'nın süresinde kargolamaması veya Şirket kararıyla tam iade yapılması hâlinde Alıcı'nın ödediği tutarın tamamı (hizmet bedeli dahil) iade edilir.",
      "7.3. Ticari Satıcılardan yapılan alışverişlerde Alıcı'nın 6502 sayılı Kanun ve Mesafeli Sözleşmeler Yönetmeliği'nden doğan cayma hakkı saklıdır; bu hakkın kullanılması hâlinde Satıcı mevzuattaki yükümlülükleri yerine getirir ve ödeme Güvenli Al üzerinden Alıcı'ya iade edilir.",
    ] },
    { h: "8. Tarafların Yükümlülükleri", p: [
      "8.1. Satıcı; ürünü Talep'e ve kendi beyanına uygun, sağlam ve eksiksiz şekilde, uygun ambalajla ve izlenebilir kargoyla göndermekle, doğru kargo bilgisini girmekle ve ticari satıcı ise fatura düzenlemekle yükümlüdür.",
      "8.2. Alıcı; doğru teslimat bilgisi vermekle, kargoyu teslim alırken hasar kontrolü yapmakla ve hasarlı kargoyu tutanak tutturmadan teslim almamakla, ürünü teslim aldıktan sonra makul sürede incelemekle ve gerçeğe aykırı sorun bildirmemekle yükümlüdür.",
      "8.3. Taraflar, Güvenli Al ile başlatılmış bir satışı Platform dışında ödeme yaparak tamamlamamayı; Güvenli Al'ı kart bilgisi denemek, nakit çekmek veya kara para aklamak gibi amaçlarla kullanmamayı kabul eder. Şüpheli işlemlerde Şirket ve Ödeme Kuruluşu işlemi durdurabilir, ek kimlik doğrulama isteyebilir ve mevzuat gereği yetkili mercilere bildirimde bulunabilir.",
    ] },
    { h: "9. Kişisel Veriler", p: [
      "Güvenli Al kapsamında işlenen veriler ve Ödeme Kuruluşu'na aktarılan bilgiler Kişisel Verilerin Korunması Aydınlatma Metni'nde açıklanmıştır. Teslimat bilgileri satışın ifası için Satıcı ile paylaşılır; Satıcı bu bilgileri yalnızca gönderim için kullanabilir.",
    ] },
    { h: "10. Yürürlük", p: [
      "Bu Sözleşme, Satıcı bakımından satış başlatılırken, Alıcı bakımından ödeme yapılmadan önce elektronik ortamda onaylanmasıyla yürürlüğe girer ve satış tamamlanana, iptal edilene veya iade edilene kadar yürürlükte kalır. Onaylanan sürüm, onay tarihiyle birlikte kayıt altına alınır.",
    ] },
  ],
};
