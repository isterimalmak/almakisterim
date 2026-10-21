-- Telefon uygulaması (iPhone / Android): anlık bildirim adresleri ve Google ile giriş dönüş biletleri.
CREATE TABLE push_tokens (
  token       text PRIMARY KEY,                       -- Expo bildirim adresi (ExponentPushToken[...])
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform    text NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_tokens_user_idx ON push_tokens (user_id);

-- Uygulamada "Google ile devam et": giriş telefonun tarayıcısında yapılır, uygulamaya tek kullanımlık, 2 dakikalık bir bilet döner.
-- Biletin kendisi değil, özeti saklanır.
CREATE TABLE auth_tickets (
  ticket_hash text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL
);
