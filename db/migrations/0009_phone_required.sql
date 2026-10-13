-- Telefon doğrulaması zorunluluğu yönetim panelinden açılıp kapatılır.
-- SMS sağlayıcısı bağlanana kadar kapalı: alıcı telefonsuz talep verebilir, satıcı telefonsuz numara açabilir.
INSERT INTO settings (key, value) VALUES ('phone_required', 'false') ON CONFLICT (key) DO NOTHING;
