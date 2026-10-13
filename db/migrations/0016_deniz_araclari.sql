-- Vasıta altına Deniz Araçları (yat, tekne, jet ski…). Talep gelene kadar gezinirken gizli kalır, talep verirken görünür.
INSERT INTO categories (id, parent_id, name, sort)
VALUES ('deniz', 'vasita', 'Deniz Araçları', (SELECT coalesce(max(sort), 0) + 1 FROM categories WHERE parent_id = 'vasita'))
ON CONFLICT (id) DO NOTHING;
