-- Ana sayfa bölümleri: yönetici "Vitrin" ve "Son eklenen talepler" bölümlerini gizleyebilir (site yeniyken boş görünmesin);
-- yerlerine ana sayfanın ortasında resim/video reklam alanı gösterilir.
ALTER TABLE ads DROP CONSTRAINT IF EXISTS ads_placement_check;
ALTER TABLE ads ADD CONSTRAINT ads_placement_check CHECK (placement IN ('sol', 'orta'));
INSERT INTO settings (key, value) VALUES ('home_vitrin', 'true'), ('home_latest', 'true') ON CONFLICT (key) DO NOTHING;
