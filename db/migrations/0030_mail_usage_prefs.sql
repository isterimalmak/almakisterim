-- E-posta gönderim sayacı (Resend ücretsiz plan: günde 100, ayda 3.000) ve üyenin e-posta bildirim tercihleri.
CREATE TABLE mail_usage (
  day  date PRIMARY KEY,
  n    integer NOT NULL DEFAULT 0
);
-- {"offer": false} gibi: yazılmayan bildirim açık sayılır (offer = yeni teklif, accepted = teklif kabul, message = yeni mesaj).
ALTER TABLE users ADD COLUMN mail_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;
