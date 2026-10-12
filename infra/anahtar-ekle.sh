#!/usr/bin/env bash
# Bir gizli anahtarı Secret Manager'a ekler. Değer ekranda görünmez, dosyaya ve geçmişe yazılmaz.
# Kullanım:  bash infra/anahtar-ekle.sh ANTHROPIC_API_KEY
set -euo pipefail
NAME="${1:-}"
ALLOWED="DATABASE_URL RESEND_API_KEY NETGSM_USERCODE NETGSM_PASSWORD ANTHROPIC_API_KEY GOOGLE_CLIENT_SECRET"
if [[ -z "$NAME" || " $ALLOWED " != *" $NAME "* ]]; then
  echo "Kullanım: bash infra/anahtar-ekle.sh ANAHTAR_ADI"
  echo "Geçerli adlar: $ALLOWED"
  exit 1
fi
read -rsp "$NAME değerini yapıştırın ve Enter'a basın (ekranda görünmez): " VALUE; echo
if [[ -z "${VALUE// }" ]]; then echo "Boş değer girildi, işlem iptal."; exit 1; fi
printf '%s' "$VALUE" | gcloud secrets versions add "$NAME" --data-file=- --quiet >/dev/null
unset VALUE
echo "✓ $NAME kaydedildi. Etkinleşmesi için bir sonraki 'Canlıya al' çalıştırmasını bekleyin."
