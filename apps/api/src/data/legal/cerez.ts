import type { LegalDoc } from "./types.js";

export const CEREZ: LegalDoc = {
  slug: "cerez-politikasi",
  title: "Çerez Politikası",
  summary: "Platform'da kullanılan çerezler ve tarayıcı depolama kayıtları, amaçları ve süreleri.",
  version: "1.2",
  effective: "2026-11-09",
  sections: [
    { h: "1. Çerez Nedir?", p: [
      "Çerezler, bir internet sitesini ziyaret ettiğinizde tarayıcınıza kaydedilen küçük metin dosyalarıdır. Tarayıcının yerel depolama (localStorage) ve oturum depolama (sessionStorage) alanları da benzer amaçla kullanılır. Bu politikada hepsi birlikte \"çerez\" olarak anılır.",
    ] },
    { h: "2. almakisterim Hangi Çerezleri Kullanır?", p: [
      "almakisterim.com, Platform'un çalışması için zorunlu olan ve tercihlerinizi hatırlayan birinci taraf çerezler kullanır. Bunlara ek olarak, yalnızca siz \"Kabul et\" derseniz, sitenin nasıl kullanıldığını ölçmeye yarayan analiz çerezleri kullanılır (5. bölüm). Reklam, profil çıkarma veya davranışsal hedefleme çerezi kullanılmaz.",
      "Siteyi ilk ziyaretinizde açılan çerez kutusundan analiz çerezlerini kabul edebilir ya da reddedebilirsiniz; reddetmeniz sitenin hiçbir bölümünü kullanmanıza engel olmaz. Tercihinizi sayfanın altındaki \"Çerez tercihleri\" bağlantısından dilediğiniz zaman değiştirebilirsiniz.",
    ] },
    { h: "3. Zorunlu Çerezler", p: [
      "ak_session — Giriş yaptığınızda oturumunuzu açık tutar. Yalnızca sunucu tarafından okunabilir (httpOnly), güvenli bağlantıyla iletilir. Süresi: 30 gün veya çıkış yapana kadar.",
      "ak_oauth_state — Google ile girişte, giriş isteğinin size ait olduğunu doğrulayarak sahte giriş girişimlerini önler. Süresi: 10 dakika.",
      "ak_g_app — Mobil uygulamadan başlatılan Google girişinin işlem sonunda uygulamaya geri dönmesini sağlar. Süresi: 10 dakika.",
    ] },
    { h: "4. Tercih ve İşlev Kayıtları (Tarayıcı Depolama)", p: [
      "ak_gorunum (yerel depolama) — Talep listesini liste veya kart görünümünde görmeyi tercih ettiğinizi hatırlar. Siz silene kadar kalır.",
      "ak_yukle_kapat (yerel depolama) — Uygulama yükleme önerisini kapattığınızı hatırlar. Siz silene kadar kalır.",
      "ak_taslak (oturum depolama) — Talep verirken yazdıklarınızın, sayfa yenilendiğinde veya geri tuşuna bastığınızda kaybolmamasını sağlar. Tarayıcı sekmesi kapanınca silinir.",
      "ak_karsilama (oturum depolama) — Karşılama duyurusunun aynı ziyaret içinde tekrar gösterilmemesini sağlar. Tarayıcı sekmesi kapanınca silinir.",
      "ak_cerez (yerel depolama) — Analiz çerezlerini kabul mü yoksa reddettiğinizi hatırlar. Siz silene veya tercihinizi değiştirene kadar kalır.",
      "Bu kayıtlar cihazınızda kalır, sunucularımıza gönderilmez.",
    ] },
    { h: "5. Analiz (Ölçüm) Çerezleri — Yalnızca Onayınızla", p: [
      "Google Analytics (_ga, _ga_* çerezleri) — Hangi sayfaların ziyaret edildiğini, ziyaretçilerin siteye hangi arama motorundan geldiğini ve kaç ziyaretin talep vermeyle sonuçlandığını toplu olarak ölçer. Google LLC tarafından sağlanır; veriler Google'ın yurt dışındaki sunucularında işlenir, reklam ve kişiselleştirme özellikleri kapalıdır. Süresi: en fazla 2 yıl.",
      "ak_kaynak (yerel depolama) — Siteye ilk geldiğiniz sitenin adını (ör. google.com) ve ilk açtığınız sayfanın adresini saklar; talep verdiğinizde bu bilgi talebinize eklenir ve hangi sayfaların talep getirdiğini ölçmek için kullanılır. Arama sözcükleriniz kaydedilmez. Süresi: 30 gün.",
      "ak_ziyaretci (yerel depolama) — Tarayıcınıza verilen rastgele bir numaradır (adınızı, e-postanızı ya da telefonunuzu içermez). Bu numarayla sitede açtığınız sayfaların adresi (arama sözcükleri ve sorgu bilgileri hariç), sayfada kaldığınız süre, cihaz türü (telefon/bilgisayar) ve siteye geldiğiniz sitenin adı sunucularımıza kaydedilir; sitenin kullanımını ve sorunlu sayfaları görmek için kullanılır. Üye girişi yaptıysanız kayıt hesabınızla ilişkilendirilir. Kayıtlar 90 gün saklanır, hesabınızı silerseniz silinir. Süresi: onayınızı geri alana kadar.",
      "Onay vermezseniz bu çerezler hiç oluşturulmaz; onayınızı geri aldığınızda yeniden oluşturulmaz.",
    ] },
    { h: "6. E-postalardaki Ölçüm", p: [
      "Yalnızca ticari elektronik ileti onayı verdiğiniz kampanya e-postalarında, e-postanın açılıp açılmadığını ve bağlantılara tıklanıp tıklanmadığını ölçmek için kişiye özel görünmez bir görsel ve yönlendirme bağlantıları kullanılır. Onayınızı geri aldığınızda bu e-postalar gönderilmez.",
    ] },
    { h: "7. Mobil Uygulama", p: [
      "Mobil uygulamada çerez yerine, oturum bilginiz cihazınızın güvenli depolama alanında (iOS Keychain / Android Keystore) saklanır. Bildirim almayı kabul ederseniz cihazınıza ait bildirim belirteci sunucularımıza kaydedilir; bildirim iznini cihaz ayarlarından dilediğiniz zaman kapatabilirsiniz.",
    ] },
    { h: "8. Üçüncü Taraf Hizmetler", p: [
      "Platform'a erişim, güvenlik ve hız amacıyla Cloudflare altyapısı üzerinden sağlanır. Cloudflare, kötü amaçlı trafiği engellemek için gerektiğinde kendi zorunlu güvenlik çerezlerini kullanabilir. Google veya Apple ile giriş yaptığınızda bu hizmetlerin sayfalarında, kendi çerez politikaları geçerlidir. Güvenli Al ödeme sayfası iyzico tarafından sunulur ve iyzico'nun çerez politikasına tabidir.",
    ] },
    { h: "9. Çerezleri Nasıl Yönetebilirsiniz?", p: [
      "Tarayıcınızın ayarlarından çerezleri ve site verilerini silebilir veya engelleyebilirsiniz. Zorunlu çerezleri engellemeniz hâlinde giriş yapamaz ve Platform'un bazı bölümlerini kullanamazsınız. Tercih kayıtlarını silmeniz hâlinde yalnızca görünüm tercihleriniz sıfırlanır.",
      "Çerezlerle işlenen kişisel verilerinize ilişkin ayrıntılı bilgi ve haklarınız için Kişisel Verilerin Korunması Aydınlatma Metni'ni inceleyebilirsiniz.",
    ] },
  ],
};
