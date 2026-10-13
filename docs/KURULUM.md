# almakisterim.com — Kurulum ve Yayın Kılavuzu

Bütün hesaplar **isterimalmak@gmail.com** ile açılır. Hiçbir anahtar sohbete, e-postaya veya koda yazılmaz.

## Durum listesi

| # | Adım | Durum |
|---|---|---|
| 1 | GitHub deposu `isterimalmak/almakisterim` | ✅ |
| 2 | Google Cloud projesi `almakisterim` + faturalandırma | ✅ |
| 3 | Google Cloud kurulum betiği (`infra/gcp-kurulum.sh`) | ✅ |
| 4 | GitHub değişkenleri | ✅ |
| 5 | Neon veritabanı (Frankfurt) → `DATABASE_URL` | ✅ |
| 6 | İlk "Canlıya al" (site run.app adresinde açılır) | ✅ |
| 7 | Anthropic (yapay zekâ) → `ANTHROPIC_API_KEY` | ⏳ |
| 8 | Resend (e-posta) → `RESEND_API_KEY` | ⏳ (alan adı gerekir) |
| 9 | Netgsm (SMS) → `NETGSM_USERCODE`, `NETGSM_PASSWORD`, başlık | ⏳ |
| 10 | Google ile giriş → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | ⏳ |
| 11 | Cloudflare R2 (fotoğraf/video) → `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | ⏳ |
| 12 | Cloudflare: alan adı + Worker | ⏳ (en son) |

## Gizli anahtarlar (Secret Manager)

| Ad | Ne | Nereden |
|---|---|---|
| `DATABASE_URL` | Veritabanı bağlantı adresi | Neon → Connect |
| `CODE_PEPPER`, `JOB_TOKEN` | Sistem içi rastgele değerler | Kurulum betiği kendisi üretir |
| `ANTHROPIC_API_KEY` | Claude | console.anthropic.com → API Keys |
| `RESEND_API_KEY` | E-posta gönderimi | resend.com → API Keys |
| `NETGSM_USERCODE`, `NETGSM_PASSWORD` | SMS | Netgsm paneli → API kullanıcısı |
| `GOOGLE_CLIENT_SECRET` | Google ile giriş | Google Cloud → APIs & Services → Credentials |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Fotoğraf ve video deposu | Cloudflare → R2 → Manage API tokens |

Eklemek için Cloud Shell'de: `bash infra/anahtar-ekle.sh ANAHTAR_ADI` (değer ekranda görünmez).

## GitHub değişkenleri (gizli değil)

GitHub → depo → **Settings → Secrets and variables → Actions → Variables** sekmesi:

| Ad | Örnek |
|---|---|
| `GCP_PROJECT_ID` | kurulum betiğinin çıktısından |
| `GCP_REGION` | `europe-west3` |
| `GCP_WIF_PROVIDER` | kurulum betiğinin çıktısından |
| `GCP_DEPLOY_SA` | kurulum betiğinin çıktısından |
| `APP_URL` | önce site run.app adresi, alan adı bağlanınca `https://almakisterim.com` |
| `ADMIN_EMAILS` | `isterimalmak@gmail.com` |
| `NETGSM_HEADER` | onaylanan SMS başlığı, ör. `ALMAKISTERIM` |
| `GOOGLE_CLIENT_ID` | Google OAuth istemci kimliği |
| `R2_ACCOUNT_ID` | Cloudflare hesap kimliği (R2 sayfasının sağında) |
| `R2_BUCKET` | `almakisterim-media` |
| `R2_PUBLIC_URL` | depo genel adresi, ör. `https://pub-xxxx.r2.dev`, alan adı bağlanınca `https://medya.almakisterim.com` |

## Onaylı yayın

Özel depolarda GitHub'ın ücretsiz planı "Environments / Required reviewers" özelliğini sunmaz. Onun yerine:

- "Canlıya al" yalnızca elle başlatılır ve onay kutusuna `CANLIYA AL` yazılması gerekir.
- Yalnızca `isterimalmak` ve sahibin "canlıya al" demesiyle Claude Code hesabı (`coskungulerlokalusta`)
  başlatabilir; yalnızca `main` dalından çalışır.
- Google Cloud tarafında da aynı koşul var (Workload Identity koşulu): başka biri, başka bir dal veya
  otomatik tetiklenen bir iş akışı Google Cloud'a hiç giremez.

## Canlıya alma

GitHub → **Actions → Canlıya al → Run workflow** → dal `main` → kutuya `CANLIYA AL` yazın → **Run workflow**.
Bitince özet sayfasında site ve API adresleri yazar.

## Cloudflare R2 (fotoğraf ve video)

1. Cloudflare → **R2 Object Storage** → **Create bucket** → ad: `almakisterim-media`, konum: **Automatic** (veya Avrupa).
2. Depo → **Settings → Public access** → **R2.dev subdomain: Allow** (alan adı bağlanınca `medya.almakisterim.com` bağlanır).
3. Depo → **Settings → CORS policy → Add CORS policy**, aşağıdakini yapıştırın:

```json
[
  {
    "AllowedOrigins": ["https://almakisterim.com", "https://*.run.app"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

4. R2 ana sayfası → **Manage API tokens → Create API token** → izin: **Object Read & Write**, yalnızca `almakisterim-media` deposu.
   Çıkan **Access Key ID** ve **Secret Access Key** değerlerini Cloud Shell'de kasaya koyun:
   `bash anahtar-ekle.sh R2_ACCESS_KEY_ID` ve `bash anahtar-ekle.sh R2_SECRET_ACCESS_KEY`.
5. GitHub değişkenleri: `R2_ACCOUNT_ID`, `R2_PUBLIC_URL` (ve isterseniz `R2_BUCKET`).

R2 ayarlanmadan yayına alınırsa site çalışır, yalnızca fotoğraf/video yükleme kapalı kalır.
