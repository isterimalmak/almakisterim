-- Gelir modeli: satıcı, alıcının telefon numarasını görmek için kredi harcar ("Numarayı gör").
-- Numarayı açan satıcı aynı talebe teklif de verebilir; teklif vermenin ayrıca ücreti yoktur.
CREATE TABLE contact_unlocks (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id  bigint NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  seller_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credits     integer NOT NULL DEFAULT 0 CHECK (credits >= 0),
  is_free     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, seller_id)
);
CREATE INDEX contact_unlocks_seller_idx ON contact_unlocks (seller_id, created_at);

-- Alıcının talep verirken numarasının paylaşılmasını onayladığı an (KVKK açık rıza kaydı).
ALTER TABLE requests ADD COLUMN contact_consent_at timestamptz;

-- Ayarlar: aylık ücretsiz numara görme hakkı, numara başına kredi (ana kategoriye göre değiştirilebilir),
-- bir talepte numarayı en fazla kaç satıcının görebileceği.
INSERT INTO settings (key, value)
  SELECT 'free_unlocks_per_month', value FROM settings WHERE key = 'free_offers_per_month'
  ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES
  ('free_unlocks_per_month', '5'),
  ('unlock_price_credits', '1'),
  ('unlock_price_by_top', '{}'),
  ('unlock_limit_per_request', '10')
  ON CONFLICT (key) DO NOTHING;
DELETE FROM settings WHERE key = 'free_offers_per_month';
