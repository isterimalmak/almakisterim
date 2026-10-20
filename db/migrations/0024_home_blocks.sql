-- Ana sayfa bölümleri (Marka Bahçem vitrinindeki gibi): hazır bölümler + yöneticinin eklediği yazı, afiş (resim/video)
-- ve kayan yazı bantları tek sıralı listede saklanır (settings.home_blocks). Afiş görselleri reklam tablosunda 'blok' yeriyle durur.
ALTER TABLE ads DROP CONSTRAINT IF EXISTS ads_placement_check;
ALTER TABLE ads ADD CONSTRAINT ads_placement_check CHECK (placement IN ('sol', 'orta', 'blok'));
