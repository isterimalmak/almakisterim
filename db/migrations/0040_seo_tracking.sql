-- Arama motorlarından gelen ziyaretçinin verdiği talepleri ölçmek için: ziyaretçinin siteye ilk geldiği yer.
-- source_ref: gelinen sitenin adı (ör. www.google.com, boşsa doğrudan giriş), source_landing: ilk açılan sayfa (ör. /nakit-araba-alanlar).
-- Kişisel veri değil; sorgu metni ya da tam adres tutulmaz.
ALTER TABLE requests ADD COLUMN source_ref text NOT NULL DEFAULT '';
ALTER TABLE requests ADD COLUMN source_landing text NOT NULL DEFAULT '';
CREATE INDEX requests_source_idx ON requests (created_at) WHERE source_ref <> '';
