-- Yönetim panelinden girilen entegrasyon anahtarları. Değerler AES-256-GCM ile şifreli saklanır
-- (şifre anahtarı Secret Manager'daki CODE_PEPPER'dan türetilir); düz metin hiçbir zaman yazılmaz.
CREATE TABLE integration_settings (
  name        text PRIMARY KEY,
  value_enc   text NOT NULL,
  updated_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
