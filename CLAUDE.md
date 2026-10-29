# almakisterim — çalışma kuralları

- Proje sahibiyle Türkçe, kısa ve adım adım konuş; tıklanacak yerleri ve adresleri açıkça yaz.
- Anahtar veya şifre isteme, sohbete yazdırma, koda/loga koyma. Anahtarları sahibi kendisi girer: Yönetim → Entegrasyonlar (şifreli saklanır, bir daha gösterilmez) ya da Secret Manager'a `infra/anahtar-ekle.sh` ile.
- Sahibi "canlıya al" demeden hiçbir şeyi yayınlama. Sahibi "canlıya al" dediğinde Claude kontrolleri çalıştırır, dalı main'e birleştirir, Canlıya al iş akışını CANLIYA AL onayıyla başlatır ve sonucu bildirir.
  Telefon uygulamasında (apps/mobile) değişiklik varsa "Uygulamayı anlık güncelle" iş akışı da başlatılır; yeni yerel bileşen eklendiyse önce "Android (Google Play)" derlemesi alınır.
- Her özellik için test yaz: API için `apps/api/test` (gerçek PostgreSQL), arayüz akışları için `apps/web/e2e` (Playwright).
- Veritabanı değişikliği = yeni numaralı `db/migrations/NNNN_aciklama.sql` dosyası; eski dosyalar değiştirilmez.
- Kullanıcıya görünen bütün metinler Türkçe.
- Gönderimden önce: `npm run typecheck -w apps/api`, `npm test -w apps/api`, `npm run build -w apps/web`.
