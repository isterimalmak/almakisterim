-- Fotoğraf ve videolar. Dosyaların kendisi Cloudflare R2'de durur; burada yalnızca kaydı tutulur.
-- Akış: yükleme izni (pending) → dosya R2'ye doğrudan yüklenir → doğrulanır (ready) → talebe veya teklife bağlanır.
CREATE TABLE media (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('image', 'video')),
  storage_key   text NOT NULL UNIQUE,
  content_type  text NOT NULL,
  size_bytes    integer NOT NULL CHECK (size_bytes > 0),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready')),
  request_id    bigint REFERENCES requests(id) ON DELETE CASCADE,
  offer_id      bigint REFERENCES offers(id) ON DELETE CASCADE,
  position      smallint NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (request_id IS NULL OR offer_id IS NULL)
);
CREATE INDEX media_request_idx ON media (request_id, position) WHERE request_id IS NOT NULL;
CREATE INDEX media_offer_idx ON media (offer_id, position) WHERE offer_id IS NOT NULL;
CREATE INDEX media_owner_idx ON media (owner_id, created_at);
