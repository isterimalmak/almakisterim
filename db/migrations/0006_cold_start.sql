-- Başlangıç dönemi (yumurta-tavuk sorunu) ayarları:
-- browse_min_requests: satıcı gezinirken bir kategorinin menüde görünmesi için gereken en az açık talep sayısı.
--   Alıcı talep verirken bütün kategoriler her zaman görünür.
-- show_counts_min: sayaçlar ("Tüm talepler (3)") bu sayının altındayken gösterilmez, site boş görünmesin.
-- launch_mode: lansman dönemi; açıkken numara görmek ücretsizdir, satıcı çekmek kolaylaşır.
INSERT INTO settings (key, value) VALUES
  ('browse_min_requests', '1'),
  ('show_counts_min', '20'),
  ('launch_mode', 'true')
  ON CONFLICT (key) DO NOTHING;
