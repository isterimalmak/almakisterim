-- iPhone uygulamasında "Apple ile Giriş" (App Store kuralı 4.8: Google ile giriş sunan uygulama Apple ile girişi de sunmalı).
ALTER TABLE users ADD COLUMN apple_sub text UNIQUE;
ALTER TABLE users DROP CONSTRAINT users_contact_check;
ALTER TABLE users ADD CONSTRAINT users_contact_check
  CHECK (deleted_at IS NOT NULL OR email IS NOT NULL OR phone IS NOT NULL OR google_sub IS NOT NULL OR apple_sub IS NOT NULL);
