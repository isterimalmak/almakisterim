#!/usr/bin/env bash
# almakisterim.com — Google Cloud tek seferlik kurulum betiği.
# Google Cloud Shell'de çalıştırılır (console.cloud.google.com → sağ üstte ">_" simgesi).
# Kullanım:  bash infra/gcp-kurulum.sh
# Tekrar çalıştırmak güvenlidir; var olanları atlar.
# Bu betik hiçbir anahtarı ekrana yazmaz. Kendi oluşturduğu gizli değerleri doğrudan Secret Manager'a koyar.
set -euo pipefail

PROJECT_ID="$(gcloud config get-value project 2>/dev/null)"
REGION="europe-west3"   # Frankfurt
GITHUB_REPO="isterimalmak/almakisterim"
# Google Cloud'a yalnızca sahibin veya sahibin "canlıya al" demesiyle Claude Code hesabının elle başlattığı,
# main dalındaki "Canlıya al" iş akışı girebilir.
WIF_CONDITION="assertion.repository=='$GITHUB_REPO' && assertion.event_name=='workflow_dispatch' && assertion.ref=='refs/heads/main' && assertion.actor in ['isterimalmak', 'coskungulerlokalusta']"

if [[ -z "$PROJECT_ID" || "$PROJECT_ID" == "(unset)" ]]; then
  echo "Önce projeyi seçin: gcloud config set project PROJE_KIMLIGI"; exit 1
fi
echo "Proje: $PROJECT_ID  Bölge: $REGION"

echo "1/6 Gerekli servisler açılıyor (birkaç dakika sürebilir)..."
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com \
  cloudscheduler.googleapis.com iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
  cloudresourcemanager.googleapis.com --quiet

echo "2/6 Docker imaj deposu..."
gcloud artifacts repositories describe almakisterim --location "$REGION" >/dev/null 2>&1 || \
  gcloud artifacts repositories create almakisterim --repository-format=docker --location "$REGION" --description="almakisterim imajları" --quiet

echo "3/6 Servis hesapları..."
RUNTIME="almakisterim-runtime@$PROJECT_ID.iam.gserviceaccount.com"
DEPLOYER="almakisterim-deployer@$PROJECT_ID.iam.gserviceaccount.com"
gcloud iam service-accounts describe "$RUNTIME" >/dev/null 2>&1 || gcloud iam service-accounts create almakisterim-runtime --display-name="almakisterim çalışma hesabı" --quiet
gcloud iam service-accounts describe "$DEPLOYER" >/dev/null 2>&1 || gcloud iam service-accounts create almakisterim-deployer --display-name="almakisterim GitHub yayın hesabı" --quiet
for ROLE in roles/run.admin roles/artifactregistry.writer roles/cloudscheduler.admin; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$DEPLOYER" --role="$ROLE" --condition=None --quiet >/dev/null
done
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME" --member="serviceAccount:$DEPLOYER" --role=roles/iam.serviceAccountUser --quiet >/dev/null

echo "4/6 GitHub'ın anahtarsız bağlanması (Workload Identity Federation)..."
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
gcloud iam workload-identity-pools describe github --location=global >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools create github --location=global --display-name="GitHub" --quiet
gcloud iam workload-identity-pools providers describe almakisterim --location=global --workload-identity-pool=github >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools providers create-oidc almakisterim --location=global --workload-identity-pool=github \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition="$WIF_CONDITION" --quiet
# Var olan sağlayıcıda da koşulu güncel tut.
gcloud iam workload-identity-pools providers update-oidc almakisterim --location=global --workload-identity-pool=github \
  --attribute-condition="$WIF_CONDITION" --quiet >/dev/null
gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/$GITHUB_REPO" --quiet >/dev/null

echo "5/6 Gizli anahtar kasası (Secret Manager)..."
has_version() { [[ -n "$(gcloud secrets versions list "$1" --filter='state=ENABLED' --limit=1 --format='value(name)' 2>/dev/null)" ]]; }
for S in DATABASE_URL CODE_PEPPER JOB_TOKEN RESEND_API_KEY NETGSM_USERCODE NETGSM_PASSWORD ANTHROPIC_API_KEY GOOGLE_CLIENT_SECRET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY; do
  gcloud secrets describe "$S" >/dev/null 2>&1 || gcloud secrets create "$S" --replication-policy=user-managed --locations="$REGION" --quiet >/dev/null
  gcloud secrets add-iam-policy-binding "$S" --member="serviceAccount:$RUNTIME" --role=roles/secretmanager.secretAccessor --quiet >/dev/null
done
gcloud secrets add-iam-policy-binding JOB_TOKEN --member="serviceAccount:$DEPLOYER" --role=roles/secretmanager.secretAccessor --quiet >/dev/null
# Sistemin kendi ürettiği rastgele değerler (kimse görmez).
for S in CODE_PEPPER JOB_TOKEN; do
  has_version "$S" || openssl rand -base64 48 | tr -d '\n' | gcloud secrets versions add "$S" --data-file=- --quiet >/dev/null
done
# Henüz eklenmemiş servis anahtarları boş (tek boşluk) olarak başlar; o özellik kapalı kalır.
for S in RESEND_API_KEY NETGSM_USERCODE NETGSM_PASSWORD ANTHROPIC_API_KEY GOOGLE_CLIENT_SECRET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY; do
  has_version "$S" || printf ' ' | gcloud secrets versions add "$S" --data-file=- --quiet >/dev/null
done

echo "6/6 Durum:"
for S in DATABASE_URL CODE_PEPPER JOB_TOKEN RESEND_API_KEY NETGSM_USERCODE NETGSM_PASSWORD ANTHROPIC_API_KEY GOOGLE_CLIENT_SECRET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY; do
  if has_version "$S"; then echo "  ✓ $S"; else echo "  ✗ $S  (eklenmesi gerekiyor: bash infra/anahtar-ekle.sh $S)"; fi
done

cat <<EOF

Kurulum tamam. GitHub'a eklenecek DEĞİŞKENLER (gizli değil):
  GCP_PROJECT_ID   = $PROJECT_ID
  GCP_REGION       = $REGION
  GCP_WIF_PROVIDER = projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/almakisterim
  GCP_DEPLOY_SA    = $DEPLOYER
EOF
