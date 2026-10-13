-- Karşılama: yöneticinin işaretlediği tek reklam, siteye girişte ekranın ortasında açılır.
ALTER TABLE ads ADD COLUMN is_welcome boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX ads_one_welcome ON ads ((true)) WHERE is_welcome;
