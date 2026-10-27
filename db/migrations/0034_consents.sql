-- Sözleşme ve rıza onay kayıtları: hangi üye, hangi metnin hangi sürümünü, ne zaman, hangi IP'den onayladı ya da geri aldı.
-- Kayıtlar delil niteliğindedir; silinmez (hesap silinince üye satırı anonimleşir, onay kaydı kalır).
CREATE TABLE consents (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id),
  doc         text NOT NULL,              -- metnin adresi (ör. uyelik-sozlesmesi)
  version     text NOT NULL,
  granted     boolean NOT NULL DEFAULT true, -- false: rızanın geri alınması
  context     text,                       -- nerede verildi (giris, talep:123, guvenli-al:45, hesap…)
  ip          text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX consents_user_doc_idx ON consents (user_id, doc, created_at DESC);

-- Sözleşmelerde görünen şirket bilgileri (Yönetim → Ayarlar → Şirket bilgileri).
INSERT INTO settings (key, value) VALUES ('legal_company', '{}') ON CONFLICT (key) DO NOTHING;
