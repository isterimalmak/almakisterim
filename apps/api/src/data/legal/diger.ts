import type { LegalDoc } from "./types.js";

export const HAK_IHLALI: LegalDoc = {
  slug: "hak-ihlali-bildirimi",
  title: "Hak İhlali Bildirimi",
  summary: "Marka, telif, kişilik hakkı veya hukuka aykırı içerik bildirimi ve içerik kaldırma usulü.",
  version: "1.0",
  effective: "2026-10-27",
  sections: [
    { h: "1. Kimler Bildirimde Bulunabilir?", p: [
      "Platform'daki bir talep, fotoğraf, mesaj veya diğer içerik nedeniyle marka, telif, tasarım, patent gibi fikrî ve sınai mülkiyet haklarının, kişilik haklarının veya özel hayatının gizliliğinin ihlal edildiğini düşünen hak sahipleri ya da yetkili temsilcileri, 5651 sayılı Kanun ve 6563 sayılı Kanun kapsamında içeriğin kaldırılması için Şirket'e bildirimde bulunabilir.",
      "Platform'daki bir talebi veya mesajı kurallara aykırı bulan her kullanıcı, ilgili sayfadaki \"Şikâyet et\" bağlantısını da kullanabilir.",
    ] },
    { h: "2. Bildirimde Bulunması Gerekenler", p: [
      "Bildirimde bulunanın adı-soyadı veya unvanı, adresi, telefon numarası ve e-posta adresi.",
      "İhlal edildiği ileri sürülen hak ve bu hakkın bildirimde bulunana ait olduğunu gösteren belgeler (marka/patent tescil belgesi, eser sahipliğini gösteren belge, vekil için yetki belgesi gibi).",
      "İhlale konu içeriğin bağlantı adresi (URL) veya talep numarası.",
      "İhlalin açıklaması ve talep edilen işlem (kaldırma, erişimin engellenmesi gibi).",
      "Bildirimin doğru olduğuna ve bildirimde bulunanın hak sahibi veya yetkilisi olduğuna dair beyan ve imza.",
    ] },
    { h: "3. Bildirim Adresi", p: [
      "Bildirimler {{EPOSTA}} adresine \"Hak İhlali Bildirimi\" konu başlığıyla e-posta olarak, {{KEP}} adresine KEP ile veya {{ADRES}} adresine yazılı olarak yapılır.",
    ] },
    { h: "4. Değerlendirme", p: [
      "4.1. Usulüne uygun bildirimler en geç 7 gün içinde incelenir. Hak ihlalinin açıkça anlaşıldığı durumlarda içerik yayından kaldırılır ve içeriği yükleyen Üye'ye bildirim yapılır.",
      "4.2. İçeriği yükleyen Üye, içeriğin hukuka uygun olduğunu düşünüyorsa gerekçesi ve belgeleriyle itiraz edebilir. Hakların çekişmeli olduğu durumlarda Şirket, taraflara yargı yolunu gösterebilir; mahkeme veya yetkili makam kararlarına derhâl uyulur.",
      "4.3. Gerçeğe aykırı veya kötü niyetli bildirimden doğan sorumluluk bildirimde bulunana aittir.",
    ] },
  ],
};

export const HESAP_SILME: LegalDoc = {
  slug: "hesap-silme",
  title: "Hesap Silme",
  summary: "Hesabınızı nasıl sileceğiniz; silinen ve yasal süre boyunca saklanan bilgiler.",
  version: "1.0",
  effective: "2026-10-27",
  sections: [
    { h: "Nasıl Silinir?", p: [
      "almakisterim.com hesabınızı ve uygulamadaki hesabınızı istediğiniz zaman silebilirsiniz: almakisterim.com'a ya da uygulamaya giriş yapın → Bana Özel → Hesap Bilgileri → en alttaki \"Hesabı sil\" bölümünde \"Hesabımı sil\" düğmesine basın ve kutuya SİL yazın.",
      "Giriş yapamıyorsanız kayıtlı telefon numaranızı veya e-posta adresinizi yazarak {{EPOSTA}} adresine \"Hesabımı silin\" konulu bir e-posta gönderin; kimliğiniz doğrulandıktan sonra hesabınız en geç 30 gün içinde silinir.",
      "Devam eden bir Güvenli Al satışınız varsa hesabınız, satış tamamlandıktan, iade edildikten veya iptal edildikten sonra silinebilir.",
    ] },
    { h: "Silinen Bilgiler", p: [
      "Adınız, telefon numaranız, e-posta adresiniz, Google veya Apple hesap bağlantınız, IBAN bilginiz, ticari ileti onayınız, oturumlarınız, talep alarmlarınız, favorileriniz, bildirimleriniz ve uygulama bildirim kayıtlarınız silinir. Açık talepleriniz ve teklifleriniz kapatılır; telefon numaranız hiçbir satıcıya gösterilmez.",
    ] },
    { h: "Yasal Süre Boyunca Saklanan Bilgiler", p: [
      "Güvenli Al satış, ödeme ve iade kayıtları (satışta verdiğiniz teslimat adı, telefon ve adres dahil), kredi ve fatura kayıtları: vergi ve ticaret mevzuatı gereği işlem tarihinden itibaren 10 yıl.",
      "Kapatılmış talepleriniz, mesajlarınız, şikâyet kayıtları ve sözleşme onay kayıtlarınız: olası uyuşmazlıklarda delil olarak kullanılmak üzere 10 yıl; bu kayıtlarda adınız \"Silinmiş üye\" olarak görünür. Karşı tarafa gönderdiğiniz mesajlar onların konuşma geçmişinde \"Silinmiş üye\" adıyla kalır.",
      "Sistem ve trafik kayıtları: 5651 sayılı Kanun uyarınca en fazla 2 yıl.",
      "Bu süreler dolduğunda kayıtlar silinir veya anonim hâle getirilir. Ayrıntılar için Kişisel Verilerin Korunması Aydınlatma Metni'ne bakabilirsiniz.",
    ] },
  ],
};

export const GUVENLI_ALISVERIS: LegalDoc = {
  slug: "guvenli-alisveris",
  title: "Güvenli Alışveriş İpuçları",
  summary: "Dolandırıcılığa karşı alıcı ve satıcıların dikkat etmesi gerekenler.",
  version: "1.0",
  effective: "2026-10-27",
  sections: [
    { h: "Alıcılar İçin", p: [
      "Ürünü görmeden ve teslim almadan kapora, ön ödeme veya havale göndermeyin. Uzaktan alışverişte Güvenli Al'ı kullanın: paranız ürünü teslim alıp onaylayana kadar bekletilir.",
      "Satıcının gönderdiği ödeme bağlantılarına, \"kargo ücreti\", \"sigorta bedeli\" gibi ek ödeme isteklerine itibar etmeyin. almakisterim sizden hiçbir zaman telefonla, SMS'le veya mesajla kart bilgisi, şifre ya da doğrulama kodu istemez.",
      "Size gelen giriş ve onay kodlarını kimseyle paylaşmayın.",
      "Araç, emlak gibi yüksek tutarlı alımlarda tapu ve noter işlemlerini resmî kurumlarda yapın; ruhsat ve tapu bilgilerini resmî kanallardan (e-Devlet) doğrulayın.",
      "Piyasanın çok altında fiyat teklifleri, acele ettiren satıcılar ve yalnızca yurt dışından ulaşılabilen kişiler dolandırıcılık işareti olabilir.",
    ] },
    { h: "Satıcılar İçin", p: [
      "Ödemeyi almadan ürünü göndermeyin; Güvenli Al'da ödeme alındı bildirimini almadan kargolamayın.",
      "Alıcının gönderdiği \"ödeme yaptım\" ekran görüntülerine, sahte banka e-postalarına itibar etmeyin; ödemeyi yalnızca Platform'da ve kendi banka hesabınızda doğrulayın.",
      "IBAN değişikliği gibi işlemleri yalnızca Bana Özel bölümünden kendiniz yapın.",
    ] },
    { h: "Şüpheli Bir Durumda", p: [
      "Şüpheli bir talep, mesaj veya kişiyle karşılaşırsanız ilgili sayfadaki \"Şikâyet et\" bağlantısıyla bize bildirin ya da {{EPOSTA}} adresine yazın. Dolandırıcılığa uğradığınızı düşünüyorsanız vakit kaybetmeden bankanıza ve en yakın emniyet birimine veya Cumhuriyet Başsavcılığına başvurun.",
    ] },
  ],
};
