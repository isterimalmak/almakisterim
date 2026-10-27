import type { LegalDoc } from "./types.js";

export const CEREZ: LegalDoc = {
  slug: "cerez-politikasi",
  title: "Çerez Politikası",
  summary: "Platform'da kullanılan çerezler ve tarayıcı depolama kayıtları, amaçları ve süreleri.",
  version: "1.0",
  effective: "2026-10-27",
  sections: [
    { h: "1. Çerez Nedir?", p: [
      "Çerezler, bir internet sitesini ziyaret ettiğinizde tarayıcınıza kaydedilen küçük metin dosyalarıdır. Tarayıcının yerel depolama (localStorage) ve oturum depolama (sessionStorage) alanları da benzer amaçla kullanılır. Bu politikada hepsi birlikte \"çerez\" olarak anılır.",
    ] },
    { h: "2. almakisterim Hangi Çerezleri Kullanır?", p: [
      "almakisterim.com yalnızca Platform'un çalışması için zorunlu olan ve tercihlerinizi hatırlayan birinci taraf çerezler kullanır. Reklam, profil çıkarma, davranışsal hedefleme veya üçüncü taraf analiz (ölçüm) çerezi kullanılmaz; bu nedenle çerez onayı istenmemektedir. İleride bu tür çerezler kullanılması hâlinde, kullanılmadan önce açık rızanız alınacaktır.",
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
      "Bu kayıtlar cihazınızda kalır, sunucularımıza gönderilmez.",
    ] },
    { h: "5. E-postalardaki Ölçüm", p: [
      "Yalnızca ticari elektronik ileti onayı verdiğiniz kampanya e-postalarında, e-postanın açılıp açılmadığını ve bağlantılara tıklanıp tıklanmadığını ölçmek için kişiye özel görünmez bir görsel ve yönlendirme bağlantıları kullanılır. Onayınızı geri aldığınızda bu e-postalar gönderilmez.",
    ] },
    { h: "6. Mobil Uygulama", p: [
      "Mobil uygulamada çerez yerine, oturum bilginiz cihazınızın güvenli depolama alanında (iOS Keychain / Android Keystore) saklanır. Bildirim almayı kabul ederseniz cihazınıza ait bildirim belirteci sunucularımıza kaydedilir; bildirim iznini cihaz ayarlarından dilediğiniz zaman kapatabilirsiniz.",
    ] },
    { h: "7. Üçüncü Taraf Hizmetler", p: [
      "Platform'a erişim, güvenlik ve hız amacıyla Cloudflare altyapısı üzerinden sağlanır. Cloudflare, kötü amaçlı trafiği engellemek için gerektiğinde kendi zorunlu güvenlik çerezlerini kullanabilir. Google veya Apple ile giriş yaptığınızda bu hizmetlerin sayfalarında, kendi çerez politikaları geçerlidir. Güvenli Al ödeme sayfası iyzico tarafından sunulur ve iyzico'nun çerez politikasına tabidir.",
    ] },
    { h: "8. Çerezleri Nasıl Yönetebilirsiniz?", p: [
      "Tarayıcınızın ayarlarından çerezleri ve site verilerini silebilir veya engelleyebilirsiniz. Zorunlu çerezleri engellemeniz hâlinde giriş yapamaz ve Platform'un bazı bölümlerini kullanamazsınız. Tercih kayıtlarını silmeniz hâlinde yalnızca görünüm tercihleriniz sıfırlanır.",
      "Çerezlerle işlenen kişisel verilerinize ilişkin ayrıntılı bilgi ve haklarınız için Kişisel Verilerin Korunması Aydınlatma Metni'ni inceleyebilirsiniz.",
    ] },
  ],
};
