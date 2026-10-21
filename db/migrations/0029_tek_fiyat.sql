-- Talepte artık fiyat aralığı yok, tek fiyat girilir: eski taleplerde en az bütçe fiyata eşitlenir.
UPDATE requests SET budget_min = budget_max WHERE budget_min IS DISTINCT FROM budget_max;
