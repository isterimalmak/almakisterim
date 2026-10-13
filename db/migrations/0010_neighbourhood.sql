-- Talepte mahalle (isteğe bağlı) ve il/ilçe aramasını hızlandıran dizin.
ALTER TABLE requests ADD COLUMN neighbourhood text NOT NULL DEFAULT '';
CREATE INDEX requests_location_idx ON requests (city, district, neighbourhood) WHERE status = 'active';
