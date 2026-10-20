-- Sitenin üst kısmında logonun yanında yazan ad (yönetim → Ayarlar'dan değiştirilir).
INSERT INTO settings (key, value) VALUES ('site_name', '"almakisterim.com"') ON CONFLICT (key) DO NOTHING;
