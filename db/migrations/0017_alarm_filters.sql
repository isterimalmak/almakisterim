-- Ayrıntılı talep alarmı: alarm, kaydedilmiş bir aramadır. Talep listesindeki süzgeçlerin aynısı saklanır
-- (il/ilçe/mahalle, bütçe aralığı, anahtar kelime, ürün durumu, kategoriye özel özellikler, araç marka/model…).
ALTER TABLE alarms ADD COLUMN filters jsonb NOT NULL DEFAULT '{}';
UPDATE alarms SET filters = jsonb_strip_nulls(jsonb_build_object('city', nullif(city, ''), 'bmin', CASE WHEN min_budget > 0 THEN min_budget::text END));
