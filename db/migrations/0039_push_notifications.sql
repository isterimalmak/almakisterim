-- Telefon uygulaması anlık bildirimleri: üyenin hangi bildirimleri istediği, cihazın son bildirim aldığı zaman
-- ve yönetimden gönderilen duyurular.
ALTER TABLE users ADD COLUMN push_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;  -- {"offer": false, ...}; yazılmayan açık sayılır
ALTER TABLE push_tokens ADD COLUMN last_sent_at timestamptz;

CREATE TABLE push_campaigns (
  id          bigserial PRIMARY KEY,
  title       text NOT NULL,
  body        text NOT NULL,
  link        text NOT NULL DEFAULT '',
  audience    text NOT NULL CHECK (audience IN ('test', 'all', 'buyers', 'sellers')),
  recipients  int NOT NULL DEFAULT 0,   -- bildirim giden üye sayısı
  devices     int NOT NULL DEFAULT 0,   -- denenen cihaz sayısı
  delivered   int NOT NULL DEFAULT 0,
  failed      int NOT NULL DEFAULT 0,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
