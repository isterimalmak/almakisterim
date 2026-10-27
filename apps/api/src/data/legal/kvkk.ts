import type { LegalDoc } from "./types.js";

export const KVKK: LegalDoc = {
  slug: "kvkk-aydinlatma-metni",
  title: "Kişisel Verilerin Korunması Aydınlatma Metni",
  summary: "Hangi kişisel verilerinizin hangi amaçla, hangi hukuki sebeple işlendiği, kimlere aktarıldığı, ne kadar saklandığı ve haklarınız.",
  version: "1.0",
  effective: "2026-10-27",
  sections: [
    { h: "1. Veri Sorumlusu", p: [
      "6698 sayılı Kişisel Verilerin Korunması Kanunu (\"Kanun\") uyarınca kişisel verileriniz, veri sorumlusu sıfatıyla {{UNVAN}} (\"almakisterim\") tarafından aşağıda açıklanan kapsamda işlenmektedir.",
      "Adres: {{ADRES}} · MERSİS: {{MERSIS}} · E-posta: {{EPOSTA}} · KEP: {{KEP}} · Telefon: {{TELEFON}}",
      "Bu metin, almakisterim.com internet sitesi, mobil sitesi ve iOS/Android uygulamaları (\"Platform\") üzerinden üyelerimiz, talep veren alıcılar, satıcılar, Güvenli Al kullanıcıları ve Platform'u ziyaret eden kişilerin kişisel verilerine ilişkindir.",
    ] },
    { h: "2. İşlenen Kişisel Veri Kategorileri", p: [
      "Kimlik: ad, soyad; Güvenli Al'da teslimat ve fatura için alıcı adı-soyadı; IBAN hesap sahibinin adı.",
      "İletişim: cep telefonu numarası, e-posta adresi, teslimat adresi (il, ilçe, açık adres).",
      "Hesap ve kullanıcı işlem: üyelik tarihi, giriş yöntemi, Google veya Apple hesap tanımlayıcısı, oturum bilgileri, verdiğiniz talepler, teklifler, mesajlar, favoriler, alarmlar, şikâyetler, bildirim tercihleri, kredi hareketleri, numarasını görüntülediğiniz talepler ve numaranızı görüntüleyen satıcılar.",
      "Talep içeriği: talep başlığı, açıklaması, kategori, il/ilçe/mahalle, fiyat, ürün özellikleri, yüklediğiniz fotoğraf ve videolar.",
      "Finansal: Güvenli Al'da satıcının IBAN bilgisi, ödeme tutarı, komisyon, taksit sayısı, ödeme ve iade kayıtları. Kart bilgileriniz almakisterim tarafından görülmez ve saklanmaz; doğrudan lisanslı ödeme kuruluşu iyzico tarafından işlenir.",
      "İşlem güvenliği: IP adresi, işlem zamanı, cihaz ve tarayıcı türü, sözleşme ve onay kayıtları, doğrulama kodu kayıtları (kodların kendisi değil, yalnızca şifrelenmiş özeti), uygulama bildirim belirteci, güvenlik ve hata kayıtları.",
      "Pazarlama: ticari elektronik ileti onayınız ve onay tarihi, e-posta kampanyalarının açılma ve bağlantı tıklama bilgisi.",
      "Platform'da özel nitelikli kişisel veri (sağlık, din, etnik köken, biyometrik veri vb.) işlenmesi amaçlanmaz. Lütfen talep ve mesajlarınızda bu tür veriler paylaşmayın.",
    ] },
    { h: "3. İşleme Amaçları ve Hukuki Sebepler", p: [
      "3.1. Üyelik oluşturma, giriş ve hesap yönetimi (ad, telefon, e-posta, Google/Apple tanımlayıcısı, oturum bilgileri): Üyelik Sözleşmesi'nin kurulması ve ifası (Kanun m.5/2-c); hesap güvenliğinin sağlanması için meşru menfaat (m.5/2-f).",
      "3.2. Talep yayınlama, yayından önce doğrulama kodu gönderme, talep süresinin takibi ve hatırlatma: sözleşmenin ifası (m.5/2-c).",
      "3.3. Telefon numaranızın talebiniz için iletişim açan satıcılarla paylaşılması: talep yayınlarken ayrıca verdiğiniz açık rıza (m.5/1). Rızanızı talep sayfasından numara paylaşımını kapatarak her zaman geri alabilirsiniz.",
      "3.4. Satıcı ile alıcı arasındaki mesajlaşma, alarm bildirimleri, teklif ve numara görüntülenme bildirimleri (SMS, e-posta, uygulama bildirimi): sözleşmenin ifası (m.5/2-c).",
      "3.5. Talep, mesaj, teklif, fotoğraf ve üye adlarının dolandırıcılık, taciz, yasaklı ürün ve kurallara aykırı içerik bakımından otomatik sistemlerle (yapay zekâ destekli) ve çalışanlarımızca denetlenmesi; yazım hatalarının düzeltilmesi: Platform'un ve diğer üyelerin güvenliğini sağlamaya yönelik meşru menfaat (m.5/2-f); 6563 ve 5651 sayılı Kanunlardan doğan yükümlülükler (m.5/2-ç). Bu denetim sonucunda talebiniz otomatik olarak reddedilebilir veya incelemeye alınabilir; kararlara {{EPOSTA}} adresinden itiraz ederek insan incelemesi isteyebilirsiniz.",
      "3.6. Tek cümleyle yazdığınız ihtiyacın talep formuna dönüştürülmesi (yapay zekâ destekli doldurma): sözleşmenin ifası (m.5/2-c). Bu işlemden önce metindeki telefon numarası ve e-posta gibi iletişim bilgileri gizlenir.",
      "3.7. Kredi satışı, ücretli hizmetlerin sunulması, fatura düzenlenmesi ve muhasebe kayıtları: sözleşmenin ifası (m.5/2-c) ve 213 sayılı Vergi Usul Kanunu ile 6102 sayılı Türk Ticaret Kanunu'ndan doğan hukuki yükümlülük (m.5/2-ç).",
      "3.8. Güvenli Al ödemelerinin alınması, bekletilmesi, satıcıya aktarılması, iadeler, kargo ve teslimat takibi, uyuşmazlıkların çözümü: sözleşmenin ifası (m.5/2-c); 6493 sayılı Ödeme ve Menkul Kıymet Mutabakat Sistemleri, Ödeme Hizmetleri ve Elektronik Para Kuruluşları Hakkında Kanun ve 5549 sayılı Kanun kapsamındaki yükümlülükler (m.5/2-ç); bir hakkın tesisi, kullanılması veya korunması (m.5/2-e).",
      "3.9. Şikâyetlerin, itirazların, hak ihlali bildirimlerinin ve destek taleplerinin incelenmesi ve sonuçlandırılması: sözleşmenin ifası (m.5/2-c), hakkın tesisi ve korunması (m.5/2-e).",
      "3.10. Sözleşme ve onay kayıtlarının tutulması, işlem güvenliği, yetkisiz erişimin ve kötüye kullanımın önlenmesi, trafik bilgilerinin saklanması: 5651 sayılı Kanun ve ilgili yönetmeliklerden doğan hukuki yükümlülük (m.5/2-ç), meşru menfaat (m.5/2-f).",
      "3.11. Yetkili kamu kurum ve kuruluşlarının bilgi ve belge taleplerinin karşılanması: kanunlarda açıkça öngörülme ve hukuki yükümlülük (m.5/2-a, m.5/2-ç).",
      "3.12. Kampanya, indirim ve tanıtım içeren ticari elektronik iletilerin gönderilmesi ve bu iletilerin açılma/tıklanma ölçümü: Ticari Elektronik İleti Onay Metni ile verdiğiniz onay ve açık rıza (m.5/1); 6563 sayılı Kanun.",
      "3.13. Platform'un iyileştirilmesi, kategori ve fiyat istatistiklerinin kişiyi tanımlamayacak şekilde hazırlanması (örneğin blog yazıları için anonim istatistikler): meşru menfaat (m.5/2-f).",
    ] },
    { h: "4. Kişisel Verilerin Toplanma Yöntemi", p: [
      "Kişisel verileriniz; Platform'daki üyelik, talep, mesaj, teklif, alarm, Güvenli Al ve hesap formlarına girdiğiniz bilgilerden, Google veya Apple ile giriş yaptığınızda bu hizmetlerin bize ilettiği bilgilerden (hesap tanımlayıcısı, doğrulanmış e-posta adresi ve ad), Platform'u kullanırken oluşan sistem kayıtlarından ve zorunlu çerezlerden, elektronik ortamda otomatik ve kısmen otomatik yollarla toplanır.",
    ] },
    { h: "5. Kişisel Verilerin Aktarıldığı Kişiler", p: [
      "5.1. Diğer üyeler: Talep içeriğiniz (başlık, açıklama, kategori, il/ilçe/mahalle, fiyat, fotoğraflar) herkese açık olarak yayınlanır; adınız talepte görünmez. Telefon numaranız yalnızca açık rızanızla ve talebiniz için iletişim açan sınırlı sayıda satıcıya gösterilir. Numaranızı açan satıcının adı (ad ve soyadın baş harfi) size gösterilir. Güvenli Al'da teslimat adınız, telefonunuz ve adresiniz ödeme yapıldıktan sonra yalnızca ilgili satıcıya gösterilir. E-posta adresiniz diğer üyelerle paylaşılmaz.",
      "5.2. Hizmet sağlayıcılar (veri işleyenler): Platform'un çalışması için aşağıdaki tedarikçilerden hizmet alınmakta ve bu tedarikçilere yalnızca hizmetin gerektirdiği veriler, sözleşmenin ifası ve meşru menfaat hukuki sebeplerine dayanarak aktarılmaktadır:",
      "• Neon (veritabanı barındırma, Frankfurt/Almanya) ve Google Cloud Platform (uygulama sunucuları, günlük kayıtları ve gizli anahtar saklama, Frankfurt/Almanya): Platform'daki tüm veriler.",
      "• Cloudflare (içerik dağıtım ağı, güvenlik, fotoğraf ve video deposu R2): Platform'a erişiminizdeki IP adresi ve istek bilgileri, yüklediğiniz fotoğraf ve videolar.",
      "• Anthropic PBC (yapay zekâ hizmeti Claude, Amerika Birleşik Devletleri): talep metinleri, mesaj ve teklif metinleri, üye adları ve talep fotoğrafları; içerik denetimi, yazım düzeltme ve talep formu doldurma amacıyla. Metinlerdeki telefon ve e-posta bilgileri gönderimden önce gizlenir. Sağlayıcı, gönderilen verileri kendi yapay zekâ modellerini eğitmek için kullanmamayı taahhüt etmektedir.",
      "• Netgsm İletişim ve Bilgi Teknolojileri A.Ş. (SMS, Türkiye): telefon numarası ve mesaj metni.",
      "• Resend (e-posta gönderimi) veya Şirket'in kendi e-posta sunucusu: e-posta adresi ve e-posta içeriği.",
      "• iyzico Ödeme Hizmetleri A.Ş. (lisanslı ödeme kuruluşu, Türkiye): Güvenli Al ve kredi ödemelerinde ad-soyad, e-posta, telefon, adres, IP adresi ve ödeme tutarı; kart bilgileri doğrudan iyzico'ya iletilir.",
      "• Google LLC ve Apple Inc. (giriş hizmetleri ve uygulama bildirimleri) ile Expo (uygulama bildirim altyapısı): giriş için hesap tanımlayıcısı, uygulama bildirimleri için cihaz bildirim belirteci ve bildirim metni.",
      "5.3. Kargo şirketleri: Güvenli Al'da gönderiyi satıcı kendi seçtiği kargo şirketiyle yapar; teslimat bilgileriniz satıcı tarafından kargo şirketine iletilir.",
      "5.4. Hukuk ve mali danışmanlar, denetçiler: hukuki yükümlülüklerin yerine getirilmesi ve hakların korunması amacıyla, gerekli olduğu ölçüde.",
      "5.5. Yetkili kamu kurum ve kuruluşları, mahkemeler, icra daireleri ve kolluk kuvvetleri: kanunda açıkça öngörülmesi ve hukuki yükümlülük kapsamında, talep edilmesi hâlinde ve talep edilen verilerle sınırlı olarak.",
    ] },
    { h: "6. Yurt Dışına Aktarım", p: [
      "6.1. Yukarıda sayılan hizmet sağlayıcıların bir kısmının sunucuları yurt dışında (Avrupa Birliği ve Amerika Birleşik Devletleri) bulunmaktadır. Bu aktarımlar, Kanun'un 9. maddesi uyarınca, Kişisel Verileri Koruma Kurulu tarafından ilan edilen standart sözleşmelerin hizmet sağlayıcılarla imzalanması ve Kurul'a süresi içinde bildirilmesi suretiyle uygun güvencelerle gerçekleştirilir.",
      "6.2. Uygun güvencenin sağlanamadığı arızi aktarımlar, Kanun'un 9/6. maddesinde sayılan hâllerde, örneğin sözleşmenin ifası için zorunlu olması veya açık rızanızın bulunması hâlinde yapılır.",
    ] },
    { h: "7. Saklama Süreleri", p: [
      "Üyelik bilgileri: üyelik süresince; hesabın silinmesiyle ad, telefon, e-posta, Google/Apple bağlantısı ve IBAN silinir.",
      "Talep, teklif ve mesaj kayıtları: üyelik süresince ve olası uyuşmazlıklarda delil olarak kullanılmak üzere sona ermeden itibaren 10 yıl (6098 sayılı Türk Borçlar Kanunu genel zamanaşımı süresi); hesap silindiğinde bu kayıtlarda adınız \"Silinmiş üye\" olarak görünür.",
      "Ödeme, kredi, fatura ve Güvenli Al kayıtları (teslimat adı, telefon ve adres dahil): işlem tarihinden itibaren 10 yıl (6102 sayılı Kanun m.82, 213 sayılı Kanun m.253).",
      "Sözleşme ve onay kayıtları: üyelik süresince ve sona ermesinden itibaren 10 yıl; ticari elektronik ileti onay ve ret kayıtları onayın geri alınmasından itibaren 3 yıl.",
      "Trafik ve sistem kayıtları (IP adresi, istek kayıtları): 5651 sayılı Kanun ve ilgili yönetmelik uyarınca en az 1, en fazla 2 yıl; uygulama hata kayıtları en fazla 30 gün.",
      "Doğrulama kodu kayıtları: en fazla 2 gün; oturum bilgileri: en fazla 30 gün veya çıkış yapılana kadar.",
      "Saklama süresi dolan veriler, Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik uyarınca ilk periyodik imha döneminde (en geç 6 ay içinde) silinir, yok edilir veya anonim hâle getirilir.",
    ] },
    { h: "8. Kanun'un 11. Maddesindeki Haklarınız", p: [
      "Kişisel verilerinizin işlenip işlenmediğini öğrenme; işlenmişse buna ilişkin bilgi talep etme; işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme; yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme; eksik veya yanlış işlenmişse düzeltilmesini isteme; Kanun'un 7. maddesindeki şartlar çerçevesinde silinmesini veya yok edilmesini isteme; düzeltme, silme veya yok etme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme; işlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme; Kanun'a aykırı işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme haklarına sahipsiniz.",
    ] },
    { h: "9. Başvuru Yöntemi", p: [
      "9.1. Haklarınıza ilişkin taleplerinizi, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ'e uygun olarak; Platform'a kayıtlı e-posta adresinizden {{EPOSTA}} adresine, güvenli elektronik imzalı olarak {{KEP}} KEP adresine veya kimliğinizi tespit edici belgelerle birlikte {{ADRES}} adresine yazılı olarak iletebilirsiniz. Başvuruda bulunması gereken bilgiler KVKK Başvuru Formu sayfasında yer almaktadır.",
      "9.2. Başvurunuz en geç 30 gün içinde ücretsiz olarak sonuçlandırılır. İşlemin ayrıca bir maliyet gerektirmesi hâlinde Kurul tarafından belirlenen tarifedeki ücret alınabilir.",
      "9.3. Hesabınızı ve hesabınıza bağlı kişisel verilerinizi Bana Özel → Hesap Bilgileri → \"Hesabı sil\" bölümünden dilediğiniz zaman kendiniz silebilirsiniz; ticari elektronik ileti onayınızı Bana Özel → Hesap Bilgileri bölümünden veya e-postalardaki \"abonelikten çık\" bağlantısından geri alabilirsiniz.",
    ] },
  ],
};

export const KVKK_BASVURU: LegalDoc = {
  slug: "kvkk-basvuru-formu",
  title: "KVKK Başvuru Formu",
  summary: "Kişisel verilerinizle ilgili haklarınızı kullanmak için başvurunuzda bulunması gereken bilgiler.",
  version: "1.0",
  effective: "2026-10-27",
  sections: [
    { h: "1. Başvuru Yolları", p: [
      "Kanun'un 11. maddesindeki haklarınıza ilişkin başvurunuzu aşağıdaki yollardan biriyle iletebilirsiniz:",
      "• almakisterim.com'a kayıtlı e-posta adresinizden {{EPOSTA}} adresine, konu satırına \"KVKK Bilgi Talebi\" yazarak,",
      "• güvenli elektronik imza veya mobil imza ile imzalayarak {{KEP}} KEP adresine,",
      "• ıslak imzalı olarak ve kimlik fotokopinizle birlikte {{ADRES}} adresine elden veya noter aracılığıyla.",
    ] },
    { h: "2. Başvuruda Bulunması Gerekenler", p: [
      "Adınız, soyadınız ve başvuru yazılı ise imzanız.",
      "Türkiye Cumhuriyeti vatandaşları için T.C. kimlik numaranız; yabancılar için uyruğunuz, pasaport numaranız veya varsa kimlik numaranız.",
      "Tebligata esas yerleşim yeri veya iş yeri adresiniz.",
      "Varsa bildirime esas e-posta adresiniz, telefon numaranız.",
      "almakisterim.com'daki üyeliğinizde kayıtlı telefon numaranız veya e-posta adresiniz (kimliğinizin doğrulanabilmesi için).",
      "Talep konunuz: hangi hakkınızı kullanmak istediğiniz (örneğin \"hakkımda işlenen verilerin bir kopyasını istiyorum\", \"şu verinin düzeltilmesini istiyorum\") ve varsa ilgili bilgi ve belgeler.",
      "Başvurunun vekil aracılığıyla yapılması hâlinde, vekilin bu konuda özel yetkiyi içeren noter onaylı vekâletnamesi.",
    ] },
    { h: "3. Değerlendirme", p: [
      "Başvurunuz, kimliğiniz doğrulandıktan sonra en geç 30 gün içinde ücretsiz olarak sonuçlandırılır ve sonucu başvuruda belirttiğiniz yolla size bildirilir. Başvurunun reddedilmesi, verilen cevabın yetersiz bulunması veya süresinde cevap verilmemesi hâlinde, cevabı öğrendiğiniz tarihten itibaren 30 gün ve her hâlde başvuru tarihinden itibaren 60 gün içinde Kişisel Verileri Koruma Kurulu'na şikâyette bulunabilirsiniz.",
      "Başkası adına bilgi talebinde bulunulamaz; üçüncü kişilere ait verilere ilişkin talepler, kanuni bir yetki bulunmadıkça yanıtlanmaz.",
    ] },
  ],
};
