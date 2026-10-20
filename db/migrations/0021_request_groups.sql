-- Birden fazla araç seçilen talep, her araç için ayrı talep olarak yayınlanır; aynı gönderimden çıkan talepler
-- aynı grup kimliğini taşır (açık talep sınırında tek talep sayılır, talep sayfasında birbirine bağlanır).
ALTER TABLE requests ADD COLUMN group_id uuid;
CREATE INDEX requests_group_idx ON requests (group_id) WHERE group_id IS NOT NULL;
