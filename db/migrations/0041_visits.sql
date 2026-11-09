-- Yönetim → Ziyaretçiler: sitede gezilen sayfalar ve girişler.
-- Sayfa kayıtları yalnız çerez kutusunda "Kabul et" diyen ziyaretçiler için tutulur (Çerez Politikası, analiz çerezleri);
-- giriş kayıtları (kind = 'login') hesap güvenliği için her girişte tutulur. Kayıtlar 90 gün saklanır, hesap silinince silinir.
CREATE TABLE visits (
  id          bigserial PRIMARY KEY,
  kind        text NOT NULL DEFAULT 'view' CHECK (kind IN ('view', 'login')),
  visitor     text NOT NULL DEFAULT '',
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
  path        text NOT NULL DEFAULT '',
  ref         text NOT NULL DEFAULT '',
  device      text NOT NULL DEFAULT '',
  duration_ms integer,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX visits_created_idx ON visits (created_at);
CREATE INDEX visits_visitor_idx ON visits (visitor, created_at);
CREATE INDEX visits_user_idx ON visits (user_id, created_at);
