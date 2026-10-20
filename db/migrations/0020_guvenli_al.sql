-- Güvenli Al: alıcı ödemeyi siteye yapar, para bekletilir; satıcı kargolar, alıcı "ürünü aldım" deyince (ya da süre dolunca)
-- satıcıya aktarılır. Sorun bildirilirse yönetici iade ya da ödeme kararı verir. Tutarlar kuruş cinsindendir.
CREATE TABLE safe_sales (
  id             bigint GENERATED ALWAYS AS IDENTITY (START WITH 700100) PRIMARY KEY,
  request_id     bigint REFERENCES requests(id) ON DELETE SET NULL,
  seller_id      uuid NOT NULL REFERENCES users(id),
  buyer_id       uuid NOT NULL REFERENCES users(id),
  title          text NOT NULL,
  description    text NOT NULL DEFAULT '',
  price          integer NOT NULL CHECK (price > 0),   -- ürün bedeli
  seller_fee     integer NOT NULL DEFAULT 0,          -- satıcının alacağından düşülen komisyon
  buyer_fee      integer NOT NULL DEFAULT 0,          -- alıcıdan alınan hizmet bedeli
  status         text NOT NULL DEFAULT 'odeme_bekliyor'
                 CHECK (status IN ('odeme_bekliyor', 'odendi', 'kargoda', 'sorunlu', 'tamamlandi', 'iade', 'iptal')),
  provider       text NOT NULL DEFAULT '',
  pay_token      text,
  pay_ref        text,
  pay_items      jsonb,                               -- iade için ödeme kalemleri (sağlayıcının işlem numaraları)
  ship_name      text, ship_phone text, ship_city text, ship_address text,
  cargo_company  text, tracking_no text,
  dispute_reason text,
  admin_note     text,
  paid_at        timestamptz,
  shipped_at     timestamptz,
  release_at     timestamptz,                         -- alıcı onay vermezse bu tarihte otomatik tamamlanır
  completed_at   timestamptz,
  refunded_at    timestamptz,
  payout_at      timestamptz,                         -- satıcıya para gönderildi
  payout_note    text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX safe_sales_seller_idx ON safe_sales (seller_id, created_at DESC);
CREATE INDEX safe_sales_buyer_idx ON safe_sales (buyer_id, created_at DESC);
CREATE INDEX safe_sales_status_idx ON safe_sales (status);
CREATE UNIQUE INDEX safe_sales_token_idx ON safe_sales (pay_token) WHERE pay_token IS NOT NULL;

-- Satışın geçmişi: kim, ne zaman, ne yaptı.
CREATE TABLE safe_sale_events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sale_id    bigint NOT NULL REFERENCES safe_sales(id) ON DELETE CASCADE,
  actor_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  kind       text NOT NULL,
  note       text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX safe_sale_events_sale_idx ON safe_sale_events (sale_id, created_at);

-- Satıcının parasının gönderileceği hesap.
ALTER TABLE users ADD COLUMN iban text;
ALTER TABLE users ADD COLUMN iban_name text;

INSERT INTO settings (key, value) VALUES
  ('safe_enabled', 'true'),
  ('safe_seller_pct', '5'),          -- satıcıdan komisyon (%)
  ('safe_buyer_pct', '1.5'),         -- alıcıdan hizmet bedeli (%)
  ('safe_min_fee', '25'),            -- satıcı komisyonu en az (TL)
  ('safe_max_fee', '2500'),          -- satıcı komisyonu en fazla (TL)
  ('safe_max_price', '250000'),      -- tek satışta en yüksek ürün bedeli (TL)
  ('safe_ship_days', '5'),           -- ödeme sonrası kargolama süresi; geçerse para alıcıya iade edilir
  ('safe_confirm_days', '10'),       -- kargodan sonra alıcının onay süresi; geçerse otomatik tamamlanır
  ('safe_tops', '["elektronik", "ev", "yedek", "moda", "bebek", "spor", "toptan"]')
ON CONFLICT (key) DO NOTHING;
