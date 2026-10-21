# Google Play ve App Store

Uygulama **Expo (React Native)** ile yazıldı: tek kod, hem Android hem iPhone (`apps/mobile`). Ekranlar uygulamanın kendisidir ve siteyle aynı sunucuyu (almakisterim.com/api) kullanır; siteye eklenen talepler, mesajlar, bildirimler uygulamada da anında görünür.

- Paket adı / Bundle ID: `com.almakisterim.app` · Adres şeması: `almakisterim://`
- Oturum: telefonun güvenli deposunda (iOS Keychain / Android Keystore); sunucuya `x-ak-session` başlığıyla gider.
- Google ile giriş: telefonun tarayıcısında yapılır (Google uygulama içi görünümde girişe izin vermez), uygulamaya 2 dakikalık tek kullanımlık bilet döner.
- Anlık bildirim: Expo Push. Sitede düşen her bildirim (yeni teklif, mesaj, alarmınıza uyan talep, numaranızı gören satıcı) telefona da gider.
- Derleme: GitHub → Actions → **Android (Google Play)** → Run workflow (main). Expo'nun bulutunda (EAS) derlenir; imza anahtarını Expo saklar.
- Gereken tek gizli değer: **EXPO_TOKEN** — expo.dev → Account settings → Access tokens → GitHub → Settings → Secrets and variables → Actions → New repository secret. Sahibi kendisi girer.
- `almakisterim.com/talep/...` bağlantılarının uygulamada açılması için Play Console'daki imza SHA-256 değeri GitHub değişkeni `ANDROID_CERT_SHA256`'ya yazılır (site `/.well-known/assetlinks.json`'da yayınlar).
- Testler: `apps/mobile/e2e` (uygulamanın tarayıcı sürümüyle Playwright), GitHub'daki "Testler" iş akışında her yayında çalışır.

## Google Play kurulumu (bir kez)

1. expo.dev'de hesap aç (ücretsiz) → Access tokens → yeni token → GitHub'a `EXPO_TOKEN` olarak gir.
2. play.google.com/console → geliştirici hesabı (25 $ tek seferlik, kimlik doğrulama).
3. GitHub → Actions → **Android (Google Play)** → Run workflow → biten çalışmanın özetindeki AAB bağlantısından dosyayı indir.
4. Play Console → **Uygulama oluştur**: ad `almakisterim`, dil Türkçe, Uygulama, Ücretsiz.
5. **Test → Dahili test** → Sürüm oluştur → `.aab` yükle (Play App Signing'i kabul et).
6. **Kurulum → Uygulama bütünlüğü → Uygulama imzalama** → "Uygulama imzalama anahtarı sertifikası" SHA-256 → GitHub değişkeni `ANDROID_CERT_SHA256` → "Canlıya al".
7. Mağaza girişi, içerik derecelendirmesi, veri güvenliği (aşağıda) → Üretim'e gönder. Sonraki sürümler iş akışındaki "Google Play'e gönder" kutusuyla doğrudan gider (Play servis hesabı anahtarı Expo'ya bir kez girilir).

Not: 2023'ten sonra açılan kişisel geliştirici hesaplarında Google, üretime çıkmadan önce **en az 12 test kullanıcısıyla 14 gün kapalı test** ister. Kurumsal (şirket) hesaplarda bu şart yoktur.

## Mağaza metinleri

- **Uygulama adı:** almakisterim – Almak İstediğini Yaz
- **Kısa açıklama (80):** Almak istediğini yaz, satıcılar sana ulaşsın. Ücretsiz talep ver.
- **Tam açıklama:**

  almakisterim tersine bir pazaryeridir: ilan arayan siz değilsiniz, sizi satıcılar bulur.

  • Ne almak istediğinizi yazın: araç, ev, telefon, eşya… Talep vermek ücretsizdir.
  • Fiyatınızı ve şehrinizi belirtin; yapay zekâ talebinizi saniyeler içinde düzenler.
  • Elinde o ürün olan satıcılar sizi arar, mesaj atar ya da teklif verir.
  • Numaranız yalnızca talebinizle ilgilenen sınırlı sayıda satıcıya açılır; kimlerin gördüğünü siz görürsünüz.
  • Satıcılar için: talep alarmı kurun, size uygun yeni talep gelince ilk siz haberdar olun.
  • Güvenli Al ile ödemeniz ürün elinize ulaşana kadar güvende kalır.

- **Kategori:** Alışveriş · **İletişim e-postası:** destek@almakisterim.com
- **Gizlilik politikası:** https://almakisterim.com/sayfa/kvkk
- **Hesap silme adresi:** https://almakisterim.com/sayfa/hesap-silme
- **Görseller:** `apps/mobile/store/` (simge 512×512, öne çıkan görsel 1024×500). Telefon ekran görüntüleri (en az 2, önerilen 4–8): ana sayfa, talep ver, talep sayfası, Bana Özel.

## Veri güvenliği formu (Play Console)

| Toplanan veri | Amaç | Paylaşılıyor mu |
|---|---|---|
| Ad | Hesap yönetimi | Hayır |
| E-posta adresi | Hesap, bildirim | Hayır |
| Telefon numarası | Hesap; talep sahibinin açık rızasıyla ilgili satıcıya gösterilir | Evet (kullanıcı onayıyla, talep için) |
| Fotoğraflar | Talebe eklenen görseller (herkese açık) | Hayır |
| Mesajlar | Alıcı–satıcı mesajlaşması | Hayır |
| Satın alma geçmişi | Güvenli Al ödemeleri | Ödeme kuruluşu ile |

- Veriler aktarım sırasında şifrelenir (HTTPS): **Evet**
- Kullanıcı verilerinin silinmesini isteyebilir: **Evet** (uygulama içinden ve hesap silme adresinden)
- Reklam kimliği kullanılmaz; izleme çerezi yoktur.

## App Store (iPhone)

Aynı kod iPhone'da da çalışır. Yüklemek için:

1. **Apple Developer hesabı** (yıllık 99 $). Derleme Expo'nun bulutunda yapılır; Mac gerekmez.
2. **Apple ile Giriş** hazır (kural 4.8): iPhone'da giriş ekranında görünür; sunucu Apple'ın imzalı jetonunu `POST /api/auth/apple` ile doğrular (alıcı: `APPLE_BUNDLE_ID`, varsayılan `com.almakisterim.app`). Apple Developer'da App ID için "Sign in with Apple" yetkisi açılmalıdır.
   - Yapılacak: Apple hesap silmede Apple jetonunun iptal edilmesini (revoke) ister; bunun için Apple Developer'dan alınacak "Sign in with Apple" anahtarı gerekir — iPhone yüklemesinden önce eklenecek.
3. Hesap silme uygulama içinden yapılabiliyor (Hesabım → Hesap Bilgileri → Hesabı sil). ✓
