-- "Numarayı gör" için güvenlik ve kontrol: iade, şikâyet, alıcının numarasını gizlemesi,
-- bütçeye göre kademeli fiyat, açık talep sınırı ve site içi bildirimler.

-- Alıcı rızasını geri alırsa numarası artık hiçbir satıcıya gösterilmez.
ALTER TABLE requests ADD COLUMN contact_hidden_at timestamptz;

-- revoked_at: alıcı bu satıcıyı şikâyet etti, numara bu satıcıdan gizlendi.
-- refunded_at / refund_credits: yönetici krediyi iade etti.
ALTER TABLE contact_unlocks
  ADD COLUMN revoked_at timestamptz,
  ADD COLUMN refunded_at timestamptz,
  ADD COLUMN refund_credits integer NOT NULL DEFAULT 0 CHECK (refund_credits >= 0);

-- Satıcı: numaraya ulaşılamıyor / yanlış numara / sahte talep. Alıcı: satıcı rahatsız etti.
CREATE TABLE contact_reports (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  unlock_id    bigint NOT NULL REFERENCES contact_unlocks(id) ON DELETE CASCADE,
  reporter_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  side         text NOT NULL CHECK (side IN ('seller', 'buyer')),
  reason       text NOT NULL CHECK (reason IN ('ulasilamiyor', 'yanlis_numara', 'sahte_talep', 'rahatsiz_etti')),
  note         text NOT NULL DEFAULT '',
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'refunded', 'rejected', 'resolved')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz,
  resolved_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (unlock_id, side)
);
CREATE INDEX contact_reports_open_idx ON contact_reports (created_at) WHERE status = 'open';

-- Site içi bildirimler (ör. "Bir satıcı numaranızı gördü").
CREATE TABLE notifications (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text        text NOT NULL,
  link        text NOT NULL DEFAULT '',
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);

-- Bütçeye göre kademeli numara fiyatı (en üst kademede max_budget null) ve kişi başı açık talep sınırı.
INSERT INTO settings (key, value) VALUES
  ('unlock_price_tiers', '[{"max_budget": 10000, "credits": 1}, {"max_budget": 100000, "credits": 3}, {"max_budget": null, "credits": 5}]'),
  ('max_active_requests_per_user', '5')
  ON CONFLICT (key) DO NOTHING;
