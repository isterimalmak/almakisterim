-- Ana sayfadaki "Acil Alım Talepleri" vitrin kutusu yönetimden açılıp kapatılır.
-- Kapalıyken acil talepler sol sütunda (kategorilerin üstünde) bağlantı olarak durur.
INSERT INTO settings (key, value) VALUES ('home_urgent_box', 'false') ON CONFLICT (key) DO NOTHING;
