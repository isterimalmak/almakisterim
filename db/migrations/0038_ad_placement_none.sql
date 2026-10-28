-- Reklam "hiçbir yerde" (yok) durabilir: ana sayfada görünmez, yalnız açılış penceresinde (is_welcome) çıkar
-- ya da yayından kaldırmadan bekletilir.
ALTER TABLE ads DROP CONSTRAINT IF EXISTS ads_placement_check;
ALTER TABLE ads ADD CONSTRAINT ads_placement_check CHECK (placement IN ('sol', 'orta', 'blok', 'yok'));
