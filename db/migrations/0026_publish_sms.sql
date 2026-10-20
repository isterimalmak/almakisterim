-- Talep verirken SMS onayı: talep yayınlanmadan önce kayıtlı cep telefonuna gelen kod girilir (Yönetim → Ayarlar'dan kapatılabilir).
INSERT INTO settings (key, value) VALUES ('publish_sms', 'true') ON CONFLICT (key) DO NOTHING;
