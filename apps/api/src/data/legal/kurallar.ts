import type { LegalDoc } from "./types.js";

export const TALEP_KURALLARI: LegalDoc = {
  slug: "talep-verme-kurallari",
  title: "Talep Verme Kuralları",
  summary: "Alım talebinin içeriği, fotoğrafları, kategorisi ve yayın süresine ilişkin kurallar (Üyelik Sözleşmesi eki).",
  version: "1.0",
  effective: "2026-10-27",
  sections: [
    { h: "1. Genel İlkeler", p: [
      "1.1. Bu kurallar Üyelik Sözleşmesi'nin ekidir. Talep veren her Üye bu kurallara uymayı kabul eder.",
      "1.2. Talep, gerçek ve güncel bir alım, kiralama veya hizmet alma ihtiyacını yansıtmalıdır. Elinizdeki ürünü satmak için Talep verilemez; almakisterim bir satış ilanı sitesi değil, alıcıların ne istediğini yazdığı bir tersine pazaryeridir.",
      "1.3. Her Talep tek bir ihtiyacı anlatır. Birbirinden farklı ürünler (örneğin bir telefon ve bir buzdolabı) aynı Talep'te istenemez. Araç taleplerinde birden fazla marka/model seçilmesi hâlinde her araç için ayrı Talep oluşturulur ve bu Talepler açık Talep sınırında tek Talep sayılır.",
      "1.4. Aynı ihtiyaç için aynı anda birden fazla Talep açılamaz; süresi dolan Talep yeniden yayınlanabilir.",
    ] },
    { h: "2. Kategori ve Ürün Özellikleri", p: [
      "2.1. Talep, istenen ürün veya hizmete en uygun kategoride verilir. Yanlış kategoride verilen Talep, Şirket tarafından doğru kategoriye taşınabilir veya yayından kaldırılabilir.",
      "2.2. Marka, model, motor/paket, hafıza, oda sayısı, m², model yılı gibi kategoriye özel alanlar gerçeği yansıtacak şekilde doldurulur. Bir alan için tercih yoksa \"Farketmez\" seçilir; Satıcıların gereksiz yere elenmemesi için yalnızca gerçekten gerekli koşullar seçilmelidir.",
      "2.3. Listede bulunmayan bir model veya özellik açıklama alanına yazılabilir.",
    ] },
    { h: "3. Başlık ve Açıklama", p: [
      "3.1. Başlık, ne aradığınızı kısa ve net anlatır (örneğin \"Kadıköy'de 3+1 kiralık daire\", \"2018 sonrası dizel otomatik BMW 3 Serisi\"). Başlıkta yalnızca büyük harf, sembol tekrarı, abartılı ifadeler ve alakasız anahtar kelimeler kullanılamaz.",
      "3.2. Başlık ve açıklamaya telefon numarası, e-posta adresi, internet adresi, sosyal medya hesabı, IBAN veya başka bir iletişim bilgisi yazılamaz. Yazılan iletişim bilgileri otomatik olarak gizlenir; iletişim yalnızca Platform üzerinden başlar.",
      "3.3. Açıklamada başka bir kişiyi, firmayı veya markayı kötüleyen, hakaret, küfür, ayrımcılık (dil, din, ırk, cinsiyet, engellilik, etnik köken vb.) içeren ifadeler kullanılamaz. Kiralık konut taleplerinde ev sahiplerine veya kiracılara yönelik ayrımcı koşullar yazılamaz.",
      "3.4. Açıklama, başka bir Talep'ten veya internet sitesinden kopyalanmış, Talep'le ilgisi olmayan metin içeremez.",
      "3.5. Yapay zekâ destekli doldurma özelliğinin önerdiği başlık ve açıklama yayından önce kontrol edilmelidir. Yayınlanan metinden Talep veren Üye sorumludur.",
    ] },
    { h: "4. Fiyat", p: [
      "4.1. Talep'te ödemeye razı olduğunuz fiyat gerçeği yansıtacak şekilde yazılır. Satıcıları yanıltmak amacıyla piyasa değerinin çok altında veya çok üstünde fiyat yazılamaz.",
      "4.2. Kiralık taleplerinde aylık kira bedeli, hizmet taleplerinde tahmini toplam bütçe yazılır.",
    ] },
    { h: "5. Fotoğraf ve Video", p: [
      "5.1. Talebe en az bir fotoğraf eklenmesi istenebilir. Fotoğraf; aradığınız ürünü temsil eden kendi çektiğiniz fotoğraf, Platform'un hazır görsel galerisinden seçilen görsel veya ücretsiz lisanslı görsel servislerinden seçilen temsilî görsel olabilir.",
      "5.2. Fotoğraf ve videolarda başka bir kişinin yüzü, plakası, kimlik belgesi, adresi veya kişisel verisi; telefon numarası, logo, filigran, internet adresi veya reklam bulunamaz.",
      "5.3. Başkasına ait olup kullanım izni bulunmayan fotoğraflar, müstehcen, şiddet içeren veya Talep'le ilgisi olmayan görseller yüklenemez.",
      "5.4. Bir Talebe en fazla 8 fotoğraf ve 1 video eklenebilir; dosya boyutu sınırları yükleme ekranında gösterilir.",
    ] },
    { h: "6. Konum", p: [
      "6.1. Talep'te ürün veya hizmeti almak istediğiniz il seçilir; ilçe ve mahalle isteğe bağlıdır. Konum, Satıcıların size uygun Talepleri bulmasını sağlar.",
      "6.2. Açık adres, site veya bina adı, kapı numarası gibi bilgiler Talep'e yazılamaz.",
    ] },
    { h: "7. Yayın, Onay ve Süre", p: [
      "7.1. Talep, cep telefonunuza gönderilen doğrulama kodu girildikten sonra yayına gönderilir.",
      "7.2. Talep'ler yayından önce ve yayında kaldıkları sürece otomatik sistemlerle ve gerektiğinde çalışanlarımızca incelenir. Kurallara uygun Talep hemen yayınlanır; şüpheli Talep elle incelemeye alınır; kurallara aykırı Talep reddedilir. Yazım hataları anlamı değiştirmeden düzeltilebilir.",
      "7.3. Talep, seçtiğiniz süre (7, 14 veya 30 gün) sonunda yayından kalkar; süre dolmadan önce size bildirim gönderilir. Talebinizi dilediğiniz zaman kapatabilirsiniz. Kapatılan veya süresi dolan Talep için telefon numaranız yeni Satıcılara gösterilmez.",
      "7.4. \"Acil\" işareti yalnızca gerçekten kısa sürede alım yapacak Alıcılar tarafından kullanılır.",
    ] },
    { h: "8. Kurallara Aykırılığın Sonuçları", p: [
      "Kurallara aykırı Talep, bildirimde bulunmaksızın düzeltilebilir, yayından kaldırılabilir veya reddedilebilir. Tekrarlanan veya ağır aykırılıklarda Üyelik Sözleşmesi'nin 12. maddesi uyarınca Hesap kısıtlanabilir veya kapatılabilir.",
    ] },
  ],
};

export const YASAKLI: LegalDoc = {
  slug: "yasakli-urunler",
  title: "Yasaklı Ürün ve Hizmetler Listesi",
  summary: "Platform'da talep verilemeyecek ve satışa aracılık edilemeyecek ürün ve hizmetler (Üyelik Sözleşmesi eki).",
  version: "1.0",
  effective: "2026-10-27",
  sections: [
    { h: "1. Genel", p: [
      "1.1. Aşağıdaki ürün ve hizmetler için Platform'da Talep verilemez; bu Talepler'e karşılık ürün veya hizmet sunulamaz, Güvenli Al ile ödeme yapılamaz.",
      "1.2. Liste örnek niteliğindedir. Satışı, alımı, bulundurulması veya reklamı mevzuatla yasaklanmış ya da izne, lisansa, ruhsata bağlanmış tüm ürün ve hizmetler, gerekli izne sahip olunduğu belgelenmedikçe yasaklı sayılır.",
    ] },
    { h: "2. Yasaklı Ürünler", p: [
      "Silah, mermi, fişek, patlayıcı ve yanıcı maddeler, havai fişek; kesici, delici aletlerin silah niteliğindeki türleri; bu ürünlerin parçaları ve yapım malzemeleri.",
      "Uyuşturucu ve uyarıcı maddeler, bunların üretiminde ve kullanımında kullanılan malzemeler; reçeteli ilaçlar, ruhsatsız ilaç, takviye ve tıbbi ürünler; insan organı, kan ve diğer biyolojik materyaller.",
      "Alkollü içecekler ve tütün mamulleri, elektronik sigara ve likitleri, nargile tütünü (4733 ve 4250 sayılı Kanunlar ile ilgili mevzuat kapsamında internet üzerinden satışı yasak olanlar).",
      "Çalıntı, kaçak, gümrüksüz veya kaynağı belirsiz ürünler; IMEI kaydı yapılmamış veya kayıt dışı cep telefonları; sahte, taklit ve marka hakkını ihlal eden ürünler (replika, \"muadil\" adıyla satılan kopya ürünler).",
      "Kimlik kartı, pasaport, ehliyet, ruhsat, diploma, fatura, resmî evrak ve bunların sahteleri; banka kartı, kredi kartı ve hesap bilgileri; abonelik ve üyelik hesapları, oyun hesapları, sosyal medya hesapları.",
      "Kamu kurumlarına ait üniforma, rozet, kimlik ve teçhizat; polis, asker ve güvenlik görevlisi kıyafetleri.",
      "Nesli tehlike altındaki hayvan ve bitkiler, yaban hayvanları, bunlardan elde edilen ürünler (fildişi, kürk vb.); evcil hayvan satışı (sahiplendirme amaçlı ücretsiz talepler hariç).",
      "Müstehcen ürünler, cinsel içerikli ürün ve hizmetler; kumar, bahis ve şans oyunu ürünleri, piyango bileti.",
      "Kişisel veri içeren listeler, veri tabanları, telefon ve e-posta listeleri; casus yazılımlar, dinleme ve gizli kayıt cihazları; korsan yazılım, lisanssız dijital içerik, kırılmış (crack) programlar.",
      "Tarihî eser niteliğindeki ürünler, kültür ve tabiat varlıkları (2863 sayılı Kanun kapsamında), defineciliğe yönelik dedektör ve ekipmanlar.",
      "Radyasyon kaynakları, zehirli ve tehlikeli kimyasallar, pestisitlerin ruhsatsız türleri.",
      "Ehliyet, ruhsat veya yetki belgesi olmadan kullanılamayan ürünlerin, belgesi olmayan kişilerce talep edilmesi.",
    ] },
    { h: "3. Yasaklı Hizmetler", p: [
      "Ödev, tez, sınav ve proje yaptırma; sınava başkası yerine girme; sahte belge, rapor veya fatura düzenleme.",
      "Kredi kartından nakit çekme, kredi aracılığı (lisanssız), tefecilik, borç para verme; kripto varlık alım-satım aracılığı; döviz, altın veya para transferi aracılığı.",
      "Takipçi, beğeni, yorum veya değerlendirme satın alma; sahte hesap açma; sosyal medya hesabı ele geçirme veya kurtarma vaadi.",
      "Yetkisiz kişilerce verilen hukuki, tıbbi, mali müşavirlik hizmetleri; ruhsatsız taşımacılık ve özel güvenlik hizmeti.",
      "Fal, büyü, medyumluk ve benzeri hizmetler; eskort ve refakat hizmetleri.",
      "Başkasının kişisel verilerinin araştırılması, bulunması veya takip edilmesi; dinleme ve gözetleme hizmetleri.",
    ] },
    { h: "4. Uyarı", p: [
      "Yasaklı ürün veya hizmete ilişkin Talepler yayından kaldırılır ve ilgili Hesap kapatılabilir. Suç teşkil eden durumlar yetkili makamlara bildirilir; yetkili makamların talebi hâlinde ilgili kayıtlar mevzuata uygun şekilde paylaşılır.",
    ] },
  ],
};

export const SATICI_KURALLARI: LegalDoc = {
  slug: "satici-kurallari",
  title: "Satıcı Kuralları",
  summary: "Alıcı numarasının kullanımı, arama ve mesaj kuralları, alarm ve şikâyet süreci (Üyelik Sözleşmesi eki).",
  version: "1.0",
  effective: "2026-10-27",
  sections: [
    { h: "1. Numaranın Görüntülenmesi", p: [
      "1.1. Alıcı'nın telefon numarası, Alıcı'nın açık rızası ile ve yalnızca o Talep'e uygun ürün veya hizmet sunabilecek Satıcıların ulaşabilmesi için paylaşılır. Bir Talep için numarayı görebilecek Satıcı sayısı sınırlıdır; bu sınır dolduğunda numara yeni Satıcılara açılmaz.",
      "1.2. Numarayı açtığınızda Alıcı'ya bildirim gider ve adınız (ad ve soyadın ilk harfi) Alıcı'nın Talep sayfasında \"numaranızı görenler\" listesinde görünür.",
      "1.3. Numara, Talep yayında olduğu sürece görünür. Talep kapanınca veya süresi dolunca, teklifiniz kabul edilmediyse numara size artık gösterilmez. Alıcı numara paylaşımını kapatırsa veya sizi şikâyet ederse numara sizden gizlenir.",
      "1.4. Aylık ücretsiz İletişim Açma hakkı ve sonrasında uygulanacak Kredi bedeli, Talep'teki fiyata ve kategoriye göre Platform'da ilan edilir.",
    ] },
    { h: "2. Numaranın Kullanımı", p: [
      "2.1. Numarayı yalnızca ilgili Talep için arama yapmak, SMS veya anlık mesajlaşma uygulaması üzerinden o Talep'e ilişkin teklif sunmak amacıyla kullanabilirsiniz.",
      "2.2. Numarayı kaydedip başka ürünleriniz için arama yapmak, kampanya mesajı göndermek, toplu mesaj listelerine eklemek, başkalarıyla paylaşmak, satmak veya bir veri tabanında toplamak kesinlikle yasaktır. Bu kullanım 6698 sayılı Kanun kapsamında hukuka aykırı veri işleme niteliğindedir ve sorumluluğu bizzat size aittir.",
      "2.3. Alıcı'yı hafta içi ve hafta sonu 09.00–21.00 saatleri dışında aramayın. Ulaşamadığınızda en fazla bir kez daha deneyin ve mesaj bırakın; ısrarlı arama yapmayın.",
      "2.4. Alıcı ilgilenmediğini söylediğinde görüşmeyi nazikçe sonlandırın ve yeniden aramayın.",
      "2.5. Kendinizi farklı bir kişi, firma veya kurum olarak tanıtmayın; almakisterim adına arandığınız izlenimini vermeyin.",
    ] },
    { h: "3. Teklif ve Mesaj Kuralları", p: [
      "3.1. Teklifiniz Talep'te istenen ürün veya hizmete uygun olmalıdır. Talep'le ilgisi olmayan ürünleri sunmayın.",
      "3.2. Ürünün durumu, kusurları, garantisi, faturası ve teslim koşulları hakkında doğru bilgi verin. Fiyatı net yazın; sonradan sürpriz masraf eklemeyin.",
      "3.3. Mesajlarda kapora, ön ödeme veya \"kargo ücreti\" adıyla Güvenli Al dışında ödeme istemeyin. Alıcı'yı başka sitelere, ödeme bağlantılarına veya uygulamalara yönlendirmeyin.",
      "3.4. Mesajlar dolandırıcılık ve kurallara aykırı içeriğin önlenmesi amacıyla otomatik sistemlerle denetlenir; kurallara aykırı mesajlar iletilmez.",
    ] },
    { h: "4. Ticari Satıcılar", p: [
      "4.1. Ticari veya mesleki faaliyeti kapsamında satış yapan Satıcılar, Alıcı'ya ticaret unvanı, adres, vergi numarası ve iletişim bilgilerini sunar; ürün için fatura düzenler; 6502 sayılı Kanun kapsamındaki ön bilgilendirme, cayma hakkı, garanti ve satış sonrası hizmet yükümlülüklerini yerine getirir.",
      "4.2. Ticari satıcı, Alıcı'nın numarasına kampanya veya tanıtım amaçlı ticari elektronik ileti göndermek için Alıcı'dan ayrıca onay almak ve İleti Yönetim Sistemi (İYS) yükümlülüklerine uymak zorundadır. Talep üzerinden açılan numara bu onay yerine geçmez.",
    ] },
    { h: "5. Talep Alarmları", p: [
      "Alarmlar, seçtiğiniz kategori, konum, fiyat aralığı ve ürün özelliklerine uyan yeni Talepler yayınlandığında size bildirim gönderir. Alarm bildirimleri bilgilendirme amaçlıdır; bir Talep'in size uygun olduğunu garanti etmez. Alarm sayısı sınırlıdır ve alarmlarınızı dilediğiniz zaman silebilirsiniz.",
    ] },
    { h: "6. Şikâyet ve Kredi İadesi", p: [
      "6.1. Numarası hatalı, ulaşılamayan, gerçek bir alım niyeti taşımayan veya kurallara aykırı bir Talep'i, numarayı açtığınız tarihten itibaren 7 gün içinde Talep sayfasından şikâyet edebilirsiniz. Şikâyet haklı bulunursa harcadığınız Kredi iade edilir.",
      "6.2. Alıcılar da kendisini rahatsız eden Satıcıyı şikâyet edebilir; şikâyet edildiğinizde o Alıcı'nın numarası sizden gizlenir. Haklı bulunan şikâyetler Hesabınızın kısıtlanmasına veya kapatılmasına yol açabilir.",
    ] },
  ],
};
