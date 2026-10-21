-- Hesap silme (Google Play / App Store zorunluluğu): üye kendi hesabını siler.
-- Kişisel bilgiler (e-posta, telefon, Google kimliği, ad, IBAN) silinir; satış ve ödeme kayıtları yasal saklama için anonim kalır.
ALTER TABLE users ADD COLUMN deleted_at timestamptz;
ALTER TABLE users DROP CONSTRAINT users_check;
ALTER TABLE users ADD CONSTRAINT users_contact_check
  CHECK (deleted_at IS NOT NULL OR email IS NOT NULL OR phone IS NOT NULL OR google_sub IS NOT NULL);
