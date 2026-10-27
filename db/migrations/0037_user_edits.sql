-- Yöneticinin üye bilgilerinde yaptığı değişiklikler: kim, ne zaman, hangi alanı, eski/yeni değer ve neden.
CREATE TABLE user_edits (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  field       text NOT NULL,
  old_value   text,
  new_value   text,
  note        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_edits_user_idx ON user_edits (user_id, created_at DESC);
