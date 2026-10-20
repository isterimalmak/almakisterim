-- Reklamın görüneceği cihaz: her yerde, yalnız telefonda ya da yalnız bilgisayarda (Yönetim → Reklam Alanları).
ALTER TABLE ads ADD COLUMN IF NOT EXISTS device text NOT NULL DEFAULT 'all' CHECK (device IN ('all', 'mobile', 'desktop'));
