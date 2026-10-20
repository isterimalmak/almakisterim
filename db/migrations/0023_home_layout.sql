-- Ana sayfa düzeni: yönetici bölümlerin sırasını değiştirir ve istediğini gizler (vitrin ve son talepler kendi ayarlarını kullanır).
INSERT INTO settings (key, value) VALUES
  ('home_order', '["hero", "urgent", "cats", "ads_m", "center_ads", "vitrin", "latest", "corp"]'),
  ('home_hidden', '[]')
ON CONFLICT (key) DO NOTHING;
