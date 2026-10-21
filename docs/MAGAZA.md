# Google Play ve App Store

Uygulama sitenin birebir aynısıdır. Android'de **Trusted Web Activity (TWA)** ile almakisterim.com Chrome'un tam ekran modunda (adres çubuğu olmadan) açılır. Site güncellenince uygulama da kendiliğinden güncellenir; mağazaya yeniden yüklemek yalnızca simge, ad gibi uygulama ayarları değişince gerekir.

- Kod: `apps/android` (paket adı `com.almakisterim.app`)
- Derleme: GitHub → Actions → **Android paketi** → Run workflow (main). Çıktı: `almakisterim-aab` (.aab)
- İmza (yükleme) anahtarı: Secret Manager'da `ANDROID_UPLOAD_KEYSTORE` / `ANDROID_UPLOAD_PASSWORD`. Bir kez Cloud Shell'de `bash infra/android-anahtar.sh` ile oluşturulur. Depoda, GitHub'da ve logda yer almaz.
- Site–uygulama bağı: `https://almakisterim.com/.well-known/assetlinks.json`. Parmak izleri GitHub → Settings → Secrets and variables → Actions → **Variables** → `ANDROID_CERT_SHA256` (virgülle ayrılmış). Değer girilip "Canlıya al" çalışınca sitede görünür. Bağ kurulmadan uygulama yine çalışır ama üstte adres çubuğu görünür.

## Google Play kurulumu (bir kez)

1. play.google.com/console → geliştirici hesabı (25 $ tek seferlik, kimlik doğrulama).
2. Cloud Shell: `bash infra/android-anahtar.sh` (yükleme anahtarı).
3. GitHub → Actions → **Android paketi** → Run workflow → biten çalışmadan `almakisterim-aab` dosyasını indir.
4. Play Console → **Uygulama oluştur**: ad `almakisterim`, dil Türkçe, Uygulama, Ücretsiz.
5. **Test → Dahili test** → Sürüm oluştur → `.aab` yükle (Play App Signing'i kabul et).
6. **Kurulum → Uygulama bütünlüğü → Uygulama imzalama**: "Uygulama imzalama anahtarı sertifikası" ve "Yükleme anahtarı sertifikası" SHA-256 değerlerini GitHub değişkeni `ANDROID_CERT_SHA256`'ya virgülle yaz → "Canlıya al".
7. Mağaza girişi, içerik derecelendirmesi, veri güvenliği (aşağıda) → Üretim'e gönder.

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
- **Görseller:** `apps/android/store/` (simge 512×512, öne çıkan görsel 1024×500). Telefon ekran görüntüleri (en az 2, önerilen 4–8): ana sayfa, talep ver, talep sayfası, Bana Özel.

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

Apple'ın kuralları Android'den farklıdır:

1. **Mac ve Apple Developer hesabı** (yıllık 99 $) gerekir; derleme Xcode ile yapılır.
2. Yalnızca siteyi gösteren uygulamalar "en az işlev" kuralı (4.2) yüzünden sık reddedilir. Uygulamaya web'de olmayan yerel özellikler eklenmelidir: anlık bildirim, kamera ile fotoğraf, paylaşım menüsü, Face ID ile giriş gibi.
3. Google ile giriş sunulduğu için **Apple ile Giriş** (Sign in with Apple) de eklenmelidir (kural 4.8).
4. Hesap silme uygulama içinden yapılabilmelidir (hazır).

Önerilen yol: Capacitor ile iOS kabuğu + yerel bildirim ve kamera + Apple ile Giriş. Android yayında oturduktan sonra ayrı iş olarak yapılır.
