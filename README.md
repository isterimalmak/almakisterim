# almakisterim.com

Alıcıların ne almak istediğini yazdığı, satıcıların bu taleplere teklif verdiği tersine pazaryeri.

## Yapı

| Klasör | İçerik |
|---|---|
| `apps/api` | Sunucu: Node.js + TypeScript + Fastify + PostgreSQL |
| `apps/web` | Site: Next.js |
| `db/migrations` | Sıralı veritabanı değişiklikleri (`0001_...sql`, `0002_...sql`) |
| `infra` | Google Cloud kurulum betiği, anahtar ekleme betiği, Cloudflare Worker |
| `.github/workflows` | `Testler` (her gönderimde), `Canlıya al` (elle ve onayla) |
| `docs/KURULUM.md` | Adım adım hesap ve yayın kurulumu |

## Yerelde çalıştırma

```bash
npm ci
# PostgreSQL 16 çalışıyor olmalı
DATABASE_URL=postgres://postgres@localhost:5432/almakisterim npm run migrate
DATABASE_URL=postgres://postgres@localhost:5432/almakisterim npm run dev:api   # http://localhost:8080
npm run dev:web                                                               # http://localhost:3000
```

Yerelde SMS ve e-posta gönderilmez; giriş kodu API'nin konsoluna yazılır.

## Testler

```bash
npm test -w apps/api      # gerçek PostgreSQL ile (TEST_DATABASE_URL)
npm test -w apps/web      # birim testleri
cd apps/web && npx playwright test   # uçtan uca (API NODE_ENV=test ile 8080'de, site 3000'de çalışırken)
```

## Güvenlik kuralları

- API anahtarları ve şifreler koda, depoya ve loglara yazılmaz; yalnızca Google Secret Manager'da durur.
- Tarayıcıya hiçbir anahtar gönderilmez; Claude, Netgsm, Resend çağrıları yalnızca sunucudan yapılır.
- Canlıya alma yalnızca GitHub'da "Canlıya al" iş akışı elle başlatılıp `production` ortamı onaylanınca olur.
