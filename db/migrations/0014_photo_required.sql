-- Fotoğrafsız talep yayınlanamaz (yönetimden kapatılabilir). Alıcı kendi fotoğrafını yükler
-- ya da hazır görsellerden (kendi galerimiz ve ücretsiz fotoğraf kaynağı) birini seçer.
INSERT INTO settings (key, value) VALUES ('photo_required', 'true') ON CONFLICT (key) DO NOTHING;
