-- Mesajlaşma: satıcı, iletişimini açtığı talebin sahibine yazar; alıcı cevap verir.
-- Bir konuşma = (talep, satıcı). Teklif sistemi arayüzden kaldırıldı; eski teklif kayıtları silinmez.
CREATE TABLE messages (
  id          bigserial PRIMARY KEY,
  request_id  bigint NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  seller_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at  timestamptz NOT NULL DEFAULT now(),
  read_at     timestamptz
);
CREATE INDEX messages_thread_idx ON messages (request_id, seller_id, created_at);
CREATE INDEX messages_unread_idx ON messages (sender_id, read_at) WHERE read_at IS NULL;
