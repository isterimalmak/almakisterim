-- Yapay zekâ asistanı: blog yazıları, yapay zekânın yaptığı her işin kaydı (geri alınabilir), günlük kullanım sayacı
-- ve otomatik e-postalar için talep işaretleri.
CREATE TABLE blog_posts (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug         text NOT NULL UNIQUE,
  title        text NOT NULL,
  summary      text NOT NULL DEFAULT '',
  body         text NOT NULL,
  topic        text NOT NULL DEFAULT '',
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  source       text NOT NULL DEFAULT 'ai' CHECK (source IN ('ai', 'manual')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
CREATE INDEX blog_posts_published_idx ON blog_posts (published_at DESC) WHERE status = 'published';

-- kind: talep_duzeltme, talep_karar, mesaj_engel, ad_engel, blog. before/after: değişen metin (geri almak için).
CREATE TABLE ai_actions (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind        text NOT NULL,
  target_id   text NOT NULL DEFAULT '',
  summary     text NOT NULL DEFAULT '',
  before      jsonb,
  after       jsonb,
  undone_at   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_actions_created_idx ON ai_actions (created_at DESC);

-- Günlük çağrı sayacı: kredi bitmesin diye üst sınır uygulanır.
CREATE TABLE ai_usage (
  day   date PRIMARY KEY,
  calls integer NOT NULL DEFAULT 0
);

ALTER TABLE requests ADD COLUMN ai_checked_at timestamptz;
ALTER TABLE requests ADD COLUMN expiry_reminded_at timestamptz;

INSERT INTO settings (key, value) VALUES
  ('ai_fix_text', 'true'),        -- talep başlığı/açıklamasında yazım düzeltme, uygunsuz kısmı silme
  ('ai_auto_decide', 'true'),     -- uygunsa yayına al, açıkça yasaklıysa reddet
  ('ai_uncertain', '"hold"'),     -- emin olamadığında: hold = incelemede tut, publish = yayına al
  ('ai_messages', 'true'),        -- mesajlarda hakaret/küfür/dolandırıcılık denetimi
  ('ai_names', 'true'),           -- üye adlarında uygunsuz ad denetimi
  ('ai_blog_every_days', '0'),    -- 0 = otomatik blog kapalı; N = her N günde bir yazı
  ('ai_blog_autopublish', 'false'),
  ('ai_daily_limit', '300'),      -- günlük en fazla yapay zekâ çağrısı
  ('auto_emails', 'true')         -- hoş geldin, talep durumu, süre dolmak üzere e-postaları
ON CONFLICT (key) DO NOTHING;
