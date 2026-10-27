-- Telefon numarası değişikliği: önce mevcut numara (ya da e-posta) ile kimlik doğrulanır, sonra yeni numara doğrulanır.
-- Her değişiklik kayıt altında kalır (kötüye kullanım, uyuşmazlık ve yasal talepler için).
CREATE TABLE phone_changes (
  id            bigserial PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES users(id),
  old_phone     text NOT NULL,
  new_phone     text,
  identity_via  text NOT NULL CHECK (identity_via IN ('sms', 'email')),
  identity_at   timestamptz,            -- kimlik doğrulandı; 15 dakika içinde yeni numara doğrulanmalı
  completed_at  timestamptz,
  ip            text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX phone_changes_user_idx ON phone_changes (user_id, created_at DESC);
