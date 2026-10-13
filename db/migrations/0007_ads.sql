-- Reklam alanları: yöneticinin eklediği resim veya video kutuları (ana sayfada sol sütunda, kategorilerin altında alt alta).
-- Dosya media tablosunda durur; reklam silinince dosya da silinir.
CREATE TABLE ads (
  id          bigserial PRIMARY KEY,
  media_id    uuid NOT NULL UNIQUE REFERENCES media(id) ON DELETE CASCADE,
  placement   text NOT NULL DEFAULT 'sol' CHECK (placement IN ('sol')),
  title       text NOT NULL DEFAULT '',
  link_url    text,
  position    integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ads_placement_idx ON ads (placement, position) WHERE is_active;
