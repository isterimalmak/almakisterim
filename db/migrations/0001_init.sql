-- almakisterim.com ilk şema
-- Bu dosya bir kez çalışır; değişiklikler yeni numaralı dosyalarla yapılır.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Kullanıcılar: e-posta, telefon veya Google ile giriş yapabilir.
CREATE TABLE users (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text UNIQUE,
  phone        text UNIQUE,
  google_sub   text UNIQUE,
  name         text NOT NULL DEFAULT '',
  role         text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_corporate boolean NOT NULL DEFAULT false,
  credits      integer NOT NULL DEFAULT 0 CHECK (credits >= 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR phone IS NOT NULL OR google_sub IS NOT NULL)
);

-- Tek kullanımlık giriş kodları (SMS / e-posta). Kodun kendisi değil, özeti saklanır.
CREATE TABLE auth_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel     text NOT NULL CHECK (channel IN ('email', 'sms')),
  target      text NOT NULL,
  code_hash   text NOT NULL,
  attempts    integer NOT NULL DEFAULT 0,
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_codes_target_idx ON auth_codes (channel, target, created_at DESC);

-- Oturumlar: tarayıcıya rastgele bir jeton verilir, veritabanında özeti tutulur.
CREATE TABLE sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

-- Kategoriler: ana kategori (parent_id NULL) ve alt kategori. Yönetici gizleyebilir.
CREATE TABLE categories (
  id         text PRIMARY KEY,
  parent_id  text REFERENCES categories(id),
  name       text NOT NULL,
  icon       text NOT NULL DEFAULT 'box',
  sort       integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true
);
CREATE INDEX categories_parent_idx ON categories (parent_id);

-- Alım talepleri. Talep No 1048200'den başlar.
CREATE TABLE requests (
  id               bigint GENERATED ALWAYS AS IDENTITY (START WITH 1048200) PRIMARY KEY,
  buyer_id         uuid NOT NULL REFERENCES users(id),
  category_id      text NOT NULL REFERENCES categories(id),
  title            text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description      text NOT NULL DEFAULT '' CHECK (char_length(description) <= 4000),
  budget_min       integer NOT NULL CHECK (budget_min >= 0),
  budget_max       integer NOT NULL CHECK (budget_max > 0),
  city             text NOT NULL,
  district         text NOT NULL DEFAULT '',
  condition        text NOT NULL CHECK (condition IN ('Sıfır', 'İkinci El', 'Farketmez', 'Hizmet')),
  attrs            jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_urgent        boolean NOT NULL DEFAULT false,
  is_corporate     boolean NOT NULL DEFAULT false,
  status           text NOT NULL DEFAULT 'active'
                   CHECK (status IN ('pending_review', 'active', 'closed', 'expired', 'rejected')),
  moderation_note  text,
  accepted_offer_id bigint,
  expires_at       timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (budget_min <= budget_max)
);
CREATE INDEX requests_list_idx ON requests (status, created_at DESC);
CREATE INDEX requests_category_idx ON requests (category_id, status);
CREATE INDEX requests_buyer_idx ON requests (buyer_id);

-- Teklifler: bir satıcı bir talebe bir kez teklif verir.
CREATE TABLE offers (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id  bigint NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  seller_id   uuid NOT NULL REFERENCES users(id),
  price       integer NOT NULL CHECK (price > 0),
  condition   text NOT NULL DEFAULT '',
  delivery    text NOT NULL DEFAULT '',
  warranty    boolean NOT NULL DEFAULT false,
  note        text NOT NULL DEFAULT '' CHECK (char_length(note) <= 2000),
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'accepted', 'rejected', 'withdrawn')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, seller_id)
);
CREATE INDEX offers_seller_idx ON offers (seller_id, created_at DESC);

ALTER TABLE requests
  ADD CONSTRAINT requests_accepted_offer_fk FOREIGN KEY (accepted_offer_id) REFERENCES offers(id);

-- Kredi hareketleri: her ekleme ve harcama kayıt altına alınır.
CREATE TABLE credit_ledger (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id),
  delta      integer NOT NULL,
  reason     text NOT NULL,
  ref        text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credit_ledger_user_idx ON credit_ledger (user_id, created_at DESC);

-- Satıcı talep alarmları.
CREATE TABLE alarms (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id text NOT NULL REFERENCES categories(id),
  city        text NOT NULL DEFAULT '',
  min_budget  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX alarms_category_idx ON alarms (category_id);

-- Favori talepler.
CREATE TABLE favorites (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id bigint NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_id)
);

-- Şikayetler.
CREATE TABLE reports (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id bigint NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES users(id),
  reason     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Yönetici ayarları (paket fiyatları, ücretsiz teklif hakkı vb.).
CREATE TABLE settings (
  key   text PRIMARY KEY,
  value jsonb NOT NULL
);
