# almakisterim iPhone / Android uygulaması

Expo (React Native) ile tek kod. Sitenin sunucusunu (almakisterim.com/api) kullanır.

- **Sekmeler:** Ana Sayfa · Talepler · Talep Ver · Mesajlar · Hesabım
- Talep sayfası (galeri, numarayı gör, ara, WhatsApp, mesaj, favori, paylaş, şikâyet; alıcı için numaranı kimler gördü / rahatsız etti / numaramı gizle), konuşmalar
- Araç talebi: birden fazla marka/model, yıl ve km aralığı, yakıt, vites; her araç kendi fotoğraflarıyla ayrı talep
- Talep ver: tek cümleden yapay zekâ ile doldurma, kameradan / galeriden fotoğraf, SMS onayı
- İlk açılışta kısa tanıtım; talep aramasında son aramalar
- Hesabım: taleplerim, favoriler, size uygun talepler, Güvenli Al (sitede, yeniden giriş istemeden), numarasını açtıklarım, ayrıntılı alarmlar (birden fazla il, ilçe, fiyat aralığı, araçta marka/model, yıl, km, yakıt, vites), bildirimler, telefon ekleme, hesap bilgileri ve bildirim tercihleri, **hesap silme**
- Giriş: SMS / e-posta kodu, Google ile devam et (telefonun tarayıcısında), Apple ile Giriş (iPhone)
- Anlık bildirim (Expo Push); bildirime dokununca ilgili ekran açılır

## Geliştirme

```bash
npm install
EXPO_PUBLIC_API_URL=http://<bilgisayarın-yerel-ip'si>:8080 npx expo start
npx tsc --noEmit
# Uçtan uca test (API 8080'de NODE_ENV=test çalışırken):
EXPO_PUBLIC_API_URL=http://localhost:8090 npm run export:web && npx playwright test
```

Mağaza adımları ve metinleri: [docs/MAGAZA.md](../../docs/MAGAZA.md)

## Mağaza kuralları

- Uygulamada **kredi satılmaz**: dijital ürün yalnız mağazanın kendi ödeme sistemiyle (Apple / Google) satılabilir; siteye ödeme bağlantısı da verilmez. Kredi bakiyesi ve aylık ücretsiz haklar görünür.
- Güvenli Al fiziksel ürün olduğundan bu kurala girmez; sitedeki sayfası uygulamadan tek kullanımlık girişle açılır.
- Kullanıcı içeriği: talep şikâyeti, satıcı şikâyeti ("rahatsız etti" → numara o satıcıdan gizlenir), numarayı gizleme ve hesap silme uygulamada var.
