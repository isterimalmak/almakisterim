#!/usr/bin/env bash
# Google Play "yükleme anahtarı"nı (upload key) bir kez oluşturur ve yalnızca Secret Manager'a koyar.
# Anahtar ve şifresi ekrana, dosyaya, GitHub'a yazılmaz; derleme iş akışı (Android paketi) buradan okur.
# Google Play App Signing açık olduğundan bu anahtar kaybolursa Play Console'dan yenisi istenebilir.
# Kullanım (Cloud Shell):  bash infra/android-anahtar.sh
set -euo pipefail
PROJECT_ID="$(gcloud config get-value project 2>/dev/null)"
DEPLOYER="almakisterim-deployer@$PROJECT_ID.iam.gserviceaccount.com"
if gcloud secrets describe ANDROID_UPLOAD_KEYSTORE >/dev/null 2>&1; then
  echo "Yükleme anahtarı zaten var; yenisi oluşturulmadı (Play'e yüklenmiş uygulamanın anahtarı değişmemeli)."
  exit 0
fi
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
PASS="$(openssl rand -base64 30 | tr -dc 'A-Za-z0-9' | head -c 32)"
keytool -genkeypair -keystore "$TMP/upload.jks" -storetype PKCS12 -alias upload -keyalg RSA -keysize 4096 -validity 10000 \
  -storepass "$PASS" -keypass "$PASS" -dname "CN=almakisterim, O=almakisterim, C=TR" >/dev/null 2>&1
for S in ANDROID_UPLOAD_KEYSTORE ANDROID_UPLOAD_PASSWORD; do
  gcloud secrets create "$S" --replication-policy=user-managed --locations=europe-west3 --quiet >/dev/null
  gcloud secrets add-iam-policy-binding "$S" --member="serviceAccount:$DEPLOYER" --role=roles/secretmanager.secretAccessor --quiet >/dev/null
done
base64 -w0 "$TMP/upload.jks" | gcloud secrets versions add ANDROID_UPLOAD_KEYSTORE --data-file=- --quiet >/dev/null
printf '%s' "$PASS" | gcloud secrets versions add ANDROID_UPLOAD_PASSWORD --data-file=- --quiet >/dev/null
FP="$(keytool -list -v -keystore "$TMP/upload.jks" -storepass "$PASS" -alias upload 2>/dev/null | awk '/SHA256:/ {print $2; exit}')"
unset PASS
echo "✓ Yükleme anahtarı oluşturuldu ve Secret Manager'a kondu."
echo "Yükleme anahtarının SHA-256 parmak izi (gizli değildir): $FP"
