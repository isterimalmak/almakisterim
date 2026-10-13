#!/usr/bin/env bash
# Bir gizli anahtarı Secret Manager'a ekler. Değer ekranda görünmez, dosyaya ve geçmişe yazılmaz.
# Kullanım:  bash infra/anahtar-ekle.sh ANTHROPIC_API_KEY
set -euo pipefail
NAME="${1:-}"
ALLOWED="DATABASE_URL RESEND_API_KEY NETGSM_USERCODE NETGSM_PASSWORD ANTHROPIC_API_KEY GOOGLE_CLIENT_SECRET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY PEXELS_API_KEY"
if [[ -z "$NAME" || " $ALLOWED " != *" $NAME "* ]]; then
  echo "Kullanım: bash infra/anahtar-ekle.sh ANAHTAR_ADI"
  echo "Geçerli adlar: $ALLOWED"
  exit 1
fi
# Kasada henüz yoksa (sonradan eklenen anahtarlar) oluşturulur ve yalnızca sitenin çalışma hesabına okuma izni verilir.
if ! gcloud secrets describe "$NAME" >/dev/null 2>&1; then
  PROJECT_ID="$(gcloud config get-value project 2>/dev/null)"
  gcloud secrets create "$NAME" --replication-policy=user-managed --locations=europe-west3 --quiet >/dev/null
  gcloud secrets add-iam-policy-binding "$NAME" --member="serviceAccount:almakisterim-runtime@$PROJECT_ID.iam.gserviceaccount.com" \
    --role=roles/secretmanager.secretAccessor --quiet >/dev/null
fi
read -rsp "$NAME değerini yapıştırın ve Enter'a basın (ekranda görünmez): " VALUE; echo
if [[ -z "${VALUE// }" ]]; then echo "Boş değer girildi, işlem iptal."; exit 1; fi
printf '%s' "$VALUE" | gcloud secrets versions add "$NAME" --data-file=- --quiet >/dev/null
unset VALUE
echo "✓ $NAME kaydedildi. Etkinleşmesi için bir sonraki 'Canlıya al' çalıştırmasını bekleyin."
