-- Hazır görsel galerisi: yöneticinin yüklediği örnek görseller (araba modeli, ev tipi vb.).
-- Alıcı talep verirken "Hazır görsellerden seç" ile kendi talebine ekler; dosya kopyalanmaz, aynı dosya paylaşılır.
ALTER TABLE media ADD COLUMN shared boolean NOT NULL DEFAULT false;
ALTER TABLE media DROP CONSTRAINT media_storage_key_key;
CREATE UNIQUE INDEX media_storage_key_own ON media (storage_key) WHERE NOT shared;

CREATE TABLE stock_images (
  id           bigserial PRIMARY KEY,
  media_id     uuid NOT NULL UNIQUE REFERENCES media(id) ON DELETE CASCADE,
  category_id  text NOT NULL REFERENCES categories(id),
  marka        text,
  model        text,
  title        text NOT NULL DEFAULT '',
  is_active    boolean NOT NULL DEFAULT true,
  uses         integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_images_cat_idx ON stock_images (category_id) WHERE is_active;
