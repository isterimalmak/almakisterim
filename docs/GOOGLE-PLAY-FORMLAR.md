# Google Play — yüklenecek her şey (kopyala-yapıştır)

Play Console: https://play.google.com/console → **Uygulama oluştur**.
Her başlığın altındaki metni olduğu gibi kopyalayın.

---

## 1. Uygulama oluştur

| Alan | Yazılacak / seçilecek |
|---|---|
| Uygulama adı | `almakisterim – Almak İstediğini Yaz` |
| Varsayılan dil | Türkçe – tr-TR |
| Uygulama mı, oyun mu? | Uygulama |
| Ücretsiz mi, ücretli mi? | Ücretsiz |
| Beyanlar | İki kutuyu da işaretleyin (Geliştirici Program Politikaları, ABD ihracat yasaları) |

---

## 2. Paket yükleme (Test → Dahili test → Yeni sürüm)

1. GitHub → Actions → **Android (Google Play)** → son başarılı çalışma → sayfanın altındaki **AAB** bağlantısı → indirin.
2. **Play App Signing**: "Google tarafından oluşturulan anahtar" → Kabul et.
3. `.aab` dosyasını sürükleyin.
4. **Sürüm adı:** `1.0.0`
5. **Sürüm notları:**

```
<tr-TR>
almakisterim'in ilk sürümü: almak istediğinizi yazın, satıcılar size ulaşsın. Talep verme, mesajlaşma, anlık bildirim ve talep alarmı.
</tr-TR>
```

6. Test kullanıcıları: **Testçiler** sekmesi → e-posta listesi oluşturun → kendi Gmail adresinizi ekleyin.

> Hesabınız **kişisel** hesapsa ve Kasım 2023'ten sonra açıldıysa, her yeni uygulama için üretime çıkmadan önce **Kapalı test**te **en az 12 kişi, 14 gün** ister (daha önce uygulama yüklemiş olmanız bu şartı kaldırmaz). Önceki uygulamanızda bu istendiyse bunda da istenecek. Şirket hesabında bu şart yok.

---

## 3. Ana mağaza girişi (Büyüme → Mağaza varlığı → Ana mağaza girişi)

**Uygulama adı (en fazla 30):**
```
almakisterim – Almak İstediğini Yaz
```

**Kısa açıklama (en fazla 80):**
```
Almak istediğini yaz, satıcılar sana ulaşsın. Ücretsiz talep ver.
```

**Tam açıklama (en fazla 4000):**
```
almakisterim tersine bir pazaryeridir: ilan arayan siz değilsiniz, sizi satıcılar bulur.

NASIL ÇALIŞIR?
• Ne almak istediğinizi yazın: araç, ev, telefon, eşya, hizmet… Talep vermek ücretsizdir.
• Fiyatınızı ve şehrinizi belirtin; yapay zekâ tek cümlenizden talebinizi saniyeler içinde düzenler.
• Elinde o ürün olan satıcılar sizi arar, mesaj atar ya da teklif verir.
• Fotoğraf ekleyin: kameradan çekin veya galeriden seçin.

GİZLİLİĞİNİZ ÖNCE GELİR
• Numaranız yalnızca talebinizle ilgilenen sınırlı sayıda satıcıya açılır.
• Numaranızı kimlerin gördüğünü siz görürsünüz; rahatsız eden satıcıdan numaranızı gizleyebilirsiniz.
• İstediğiniz an numaranızı tamamen gizleyebilir, hesabınızı uygulama içinden silebilirsiniz.

SATICILAR İÇİN
• Talep alarmı kurun: il, ilçe, fiyat aralığı, araçta marka/model, yıl, km, yakıt ve vites seçin.
• Size uygun yeni talep gelince anlık bildirimle ilk siz haberdar olun.
• Alıcıyla doğrudan arayarak, WhatsApp'tan ya da uygulama içi mesajla görüşün.

GÜVENLİ AL
• Ödemeniz ürün elinize ulaşana kadar güvende kalır.

Araç almak isteyenler için birden fazla marka/model, yıl ve km aralığı seçerek tek seferde talep verebilirsiniz.

almakisterim ile aradığınızı bulmak için ilan ilan gezmenize gerek yok. Almak istediğinizi yazın, gerisini satıcılara bırakın.

Destek: destek@almakisterim.com
```

**Görseller** (dosyalar repoda `apps/mobile/store/` klasöründe):

| Alan | Dosya |
|---|---|
| Uygulama simgesi (512×512 PNG) | `uygulama-simgesi-512.png` |
| Öne çıkan görsel (1024×500) | `one-cikan-gorsel-1024x500.png` |
| Telefon ekran görüntüleri (2–8 adet, dikey) | `ekran-1-...png` … (hazırlanacak — aşağıdaki nota bakın) |
| Tablet ekran görüntüleri | Boş bırakın (uygulama yalnız telefon) |

Ekran görüntüleri sırası: 1) Ana sayfa · 2) Talep Ver (yapay zekâ ile doldur) · 3) Talep sayfası · 4) Mesajlar · 5) Talep alarmı · 6) Hesabım.

---

## 4. Mağaza ayarları (Büyüme → Mağaza varlığı → Mağaza ayarları)

| Alan | Değer |
|---|---|
| Uygulama veya oyun | Uygulama |
| Kategori | Alışveriş |
| Etiketler | Alışveriş, Pazaryeri, İlanlar (listede ne varsa en yakınları) |
| E-posta | `destek@almakisterim.com` |
| Telefon | Boş bırakılabilir |
| Web sitesi | `https://almakisterim.com` |
| Harici pazarlama | İşaretli kalabilir |

---

## 5. Uygulama içeriği (Politika → Uygulama içeriği)

### 5.1 Gizlilik politikası
```
https://almakisterim.com/sayfa/kvkk
```

### 5.2 Uygulama erişimi
Seçin: **"Tüm işlevler veya bazı işlevler kısıtlanmıştır"** → Talimat ekle:

- **Ad:** `İnceleme hesabı`
- **Kullanıcı adı / şifre:** ⚠️ Şu an uygulamada SMS/e-posta koduyla giriş var; Google inceleme ekibi bu kodu alamaz. Bunun için sabit kodlu bir **inceleme hesabı** eklenmesi gerekiyor (aşağıda "Eksikler"e bakın). Eklenince buraya o telefon numarası ve kod yazılacak.
- **Diğer bilgiler:**
```
Ana sayfa ve talepler giriş yapmadan gezilebilir. Talep vermek, mesajlaşmak ve Hesabım için Hesabım sekmesi > Giriş yap / Üye ol > yukarıdaki telefon numarası > Kod gönder > yukarıdaki 6 haneli kod.
```

### 5.3 Reklamlar
**Hayır, uygulamamda reklam yok.**

### 5.4 İçerik derecelendirmesi
E-posta: `destek@almakisterim.com` · Kategori: **"Diğer tüm uygulama türleri"** (veya varsa "Sosyal ağ / iletişim" değil — Alışveriş için "Diğer").

| Soru | Cevap |
|---|---|
| Şiddet içeriği | Hayır |
| Korku / ürkütücü içerik | Hayır |
| Cinsellik, çıplaklık | Hayır |
| Küfür / kaba dil | Hayır |
| Uyuşturucu, alkol, tütün | Hayır |
| Kumar / benzetilmiş kumar | Hayır |
| Kullanıcılar birbiriyle etkileşebilir mi / içerik paylaşabilir mi? | **Evet** (mesajlaşma, talep paylaşma) |
| Kullanıcının tam konumu başkalarıyla paylaşılıyor mu? | Hayır (yalnız il/ilçe) |
| Dijital ürün satın alma | Hayır (uygulamada dijital ürün satılmaz) |
| Nefret söylemi / ayrımcılık | Hayır |

### 5.5 Hedef kitle ve içerik
- **Hedef yaş grupları:** yalnızca **18 ve üzeri**
- **Çocukların ilgisini çekebilir mi?** Hayır
- Mağazada "çocuklar için değil" gösterimi: Evet

### 5.6 Haber uygulaması
**Hayır**

### 5.7 COVID-19 / Sağlık
**Hayır** (sağlık uygulaması değil)

### 5.8 Devlet uygulaması
**Hayır**

### 5.9 Finansal özellikler
**"Uygulamamda bu özelliklerin hiçbiri yok"** seçin. (Güvenli Al, fiziksel ürün için ödeme kuruluşu üzerinden yapılan bir aracılıktır; kredi, yatırım, kripto vb. yoktur.) Eğer "Ödeme işleme" seçeneği soruluyorsa: ödeme kuruluşu (iyzico/PayTR vb.) üzerinden işlendiğini belirtin.

### 5.10 Reklam kimliği (Advertising ID)
**Hayır**, uygulama reklam kimliğini kullanmıyor. (Uygulamada `AD_ID` izni engelli.)

### 5.11 Hesap silme
- Uygulama içinden hesap silinebiliyor mu? **Evet** — Hesabım → Hesap Bilgileri → Hesabı sil
- Web bağlantısı:
```
https://almakisterim.com/sayfa/hesap-silme
```

### 5.12 Veri güvenliği

**Genel sorular**
| Soru | Cevap |
|---|---|
| Kullanıcı verisi topluyor veya paylaşıyor mu? | Evet |
| Tüm veriler aktarım sırasında şifreleniyor mu? | Evet |
| Kullanıcılar verilerinin silinmesini isteyebilir mi? | Evet |
| Hesap oluşturma yöntemi | Telefon numarası, e-posta, Google ile giriş (OAuth) |

**Toplanan veri türleri** (işaretlenecekler — gerisi boş):

| Veri | Toplanıyor | Paylaşılıyor | Zorunlu mu | Amaç |
|---|---|---|---|---|
| Kişisel bilgiler → **Ad** | Evet | Hayır | Zorunlu | Hesap yönetimi, uygulama işlevleri |
| Kişisel bilgiler → **E-posta adresi** | Evet | Hayır | İsteğe bağlı | Hesap yönetimi, iletişim |
| Kişisel bilgiler → **Telefon numarası** | Evet | **Evet** | Zorunlu | Uygulama işlevleri, hesap yönetimi. Paylaşım: kullanıcının talebiyle ilgilenen satıcıya, kullanıcı başlatınca |
| Konum → **Yaklaşık konum** | Evet (kullanıcının seçtiği il/ilçe, GPS değil) | Hayır | Zorunlu | Uygulama işlevleri |
| Fotoğraflar ve videolar → **Fotoğraflar** | Evet | Hayır | İsteğe bağlı | Uygulama işlevleri (talebe eklenen görsel) |
| Mesajlar → **Uygulama içi mesajlar** | Evet | Hayır | İsteğe bağlı | Uygulama işlevleri |
| Finansal bilgiler → **Satın alma geçmişi** | Evet | Hayır | İsteğe bağlı | Uygulama işlevleri (Güvenli Al) |
| Uygulama etkinliği → **Uygulama içi aramalar** | Evet | Hayır | İsteğe bağlı | Uygulama işlevleri (son aramalar) |
| Cihaz veya diğer kimlikler | Evet (bildirim jetonu) | Hayır | Zorunlu | Uygulama işlevleri (anlık bildirim) |

Her veri için "Geçici olarak mı işleniyor?" → **Hayır**.
Ödeme bilgileri (kart) uygulamada toplanmaz; ödeme kuruluşunun sayfasında girilir → **Finansal bilgiler → Kart bilgisi işaretlenmez**.

> Not: Telefon numarasının satıcıya gösterilmesi kullanıcının kendi isteğiyle (talebini yayınlayarak) olduğu için Google'ın tanımına göre "paylaşım" sayılmayabilir; ama "Evet" demek daha güvenlidir.

---

## 6. Ülkeler (Üretim / Test → Ülkeler/bölgeler)
**Türkiye** seçin.

---

## 7. Gönderim
Yayın özeti (Publishing overview) → **İncelemeye gönder**.

---

## Eksikler (yüklemeden önce)
1. **Telefon ekran görüntüleri** (en az 2, önerilen 6) — henüz yok.
2. **Google inceleme hesabı** — sabit kodla giriş yapılabilen tek bir hesap; Google ekibi SMS kodu alamadığı için gerekli.
3. Paket yüklendikten sonra **Uygulama imzalama SHA-256** değeri → GitHub değişkeni `ANDROID_CERT_SHA256` (talep bağlantılarının uygulamada açılması için).
