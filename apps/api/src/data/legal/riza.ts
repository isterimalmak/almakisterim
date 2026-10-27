import type { LegalDoc } from "./types.js";

export const ACIK_RIZA: LegalDoc = {
  slug: "acik-riza-metni",
  title: "Açık Rıza Metni – Telefon Numarasının Satıcılarla Paylaşılması",
  summary: "Talep verirken telefon numaranızın, talebiniz için iletişim açan satıcılarla paylaşılmasına ilişkin açık rıza.",
  version: "1.0",
  effective: "2026-10-27",
  consent: true,
  sections: [
    { h: "Rızanın Konusu", p: [
      "almakisterim.com'da yayınladığım alım talebi için, cep telefonu numaramın ve adımın baş harflerinin, {{UNVAN}} tarafından, talebime uygun ürün veya hizmet sunmak isteyen ve Platform'da ilan edilen koşullarla iletişim açan satıcılara (bir talep için Platform'da ilan edilen azami satıcı sayısıyla sınırlı olarak) gösterilmesine; bu satıcıların beni yalnızca ilgili talep hakkında telefonla arayabilmesine, SMS veya anlık mesajlaşma uygulaması üzerinden ulaşabilmesine açık rıza veriyorum.",
    ] },
    { h: "Bilgilendirme", p: [
      "Satıcılar gerçek veya tüzel kişi olabilir; numaranızı gördükleri andan itibaren kendi sorumlulukları altında, yalnızca ilgili talep için kullanmakla yükümlüdürler (Satıcı Kuralları).",
      "Numaranızı hangi satıcıların gördüğünü talep sayfanızda takip edebilirsiniz.",
      "Rızanız her talep için ayrı ayrı alınır. Rıza vermemeniz hâlinde talebiniz yine yayınlanabilir; satıcılar size yalnızca Platform içi mesajla ulaşabilir.",
      "Rızanızı dilediğiniz zaman talep sayfanızdaki \"numaramı gizle\" seçeneğiyle ya da talebi kapatarak geri alabilirsiniz. Geri alma ileriye dönük sonuç doğurur: numaranız yeni satıcılara gösterilmez ve daha önce görmüş satıcılar için de gizlenir; ancak satıcıların daha önce kendi cihazlarına kaydettiği numaralar bakımından Şirket'in teknik bir müdahale imkânı yoktur.",
      "Ayrıntılı bilgi için Kişisel Verilerin Korunması Aydınlatma Metni'ni inceleyebilirsiniz.",
    ] },
  ],
};

export const ETI: LegalDoc = {
  slug: "ticari-elektronik-ileti-onayi",
  title: "Ticari Elektronik İleti Onay Metni",
  summary: "Kampanya, indirim ve tanıtım içeren e-posta, SMS ve bildirim gönderimine ilişkin isteğe bağlı onay.",
  version: "1.0",
  effective: "2026-10-27",
  consent: true,
  sections: [
    { h: "Onayın Konusu", p: [
      "6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun ve Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik uyarınca; {{UNVAN}} tarafından, almakisterim.com'da sunulan hizmetler, kampanyalar, indirimler, kredi paketleri, yeni özellikler ve bunlara ilişkin tanıtımlar hakkında, Hesabımda kayıtlı e-posta adresime, cep telefonu numarama ve mobil uygulamaya bildirim olarak ticari elektronik ileti gönderilmesine onay veriyorum.",
      "Bu amaçla ad, soyad, e-posta adresi, telefon numarası, bildirim tercihleri ile e-postaların açılma ve bağlantı tıklanma bilgilerimin işlenmesine ve gönderimin yapılabilmesi için e-posta, SMS ve bildirim hizmeti sağlayıcılarına aktarılmasına açık rıza veriyorum.",
    ] },
    { h: "Bilgilendirme", p: [
      "Bu onay isteğe bağlıdır; vermemeniz üyeliğinizi ve Platform'daki hiçbir hizmeti etkilemez.",
      "Giriş kodu, talep onayı, numara görüntülenme, yeni mesaj, alarm eşleşmesi, Güvenli Al durumu ve sözleşme değişikliği gibi üyeliğinizle ilgili bilgilendirme iletileri bu onaydan bağımsız olarak gönderilir.",
      "Onayınızı dilediğiniz zaman, hiçbir gerekçe göstermeden ve ücretsiz olarak Bana Özel → Hesap Bilgileri bölümünden, e-postalardaki \"abonelikten çık\" bağlantısından veya {{EPOSTA}} adresine yazarak geri alabilirsiniz. Ret bildiriminiz en geç 3 iş günü içinde işleme alınır.",
      "Tacir veya esnaf olan üyelerimiz bakımından, mevzuat uyarınca onay alınmasına gerek bulunmayan iletiler, ret hakkı saklı kalmak kaydıyla gönderilebilir.",
      "Onay ve ret kayıtlarınız, geri alınmasından itibaren 3 yıl saklanır.",
    ] },
  ],
};
