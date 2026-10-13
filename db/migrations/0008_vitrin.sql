-- Vitrin: yöneticinin öne çıkardığı talepler ana sayfa vitrininde en başta görünür (ileride ücretli öne çıkarma).
ALTER TABLE requests ADD COLUMN featured_until timestamptz;
CREATE INDEX requests_featured_idx ON requests (featured_until) WHERE featured_until IS NOT NULL;
