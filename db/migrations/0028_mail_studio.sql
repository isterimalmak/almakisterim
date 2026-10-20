-- E-posta Stüdyosu: yönetimin bloklarla tasarladığı şablonlar, bunlara verilen görevler (kime, ne zaman) ve gönderim kuyruğu
-- (Marka Bahçem'deki E-posta Stüdyosu'ndan alındı; tetikleyiciler ve kitleler almakisterim'e uyarlandı.)

-- Kampanya e-postası izni: boşsa kişiye kampanya (pazarlama) e-postası gitmez. Üye "Hesap Bilgileri"nden açıp kapatır.
ALTER TABLE users ADD COLUMN marketing_at timestamptz;

CREATE TABLE IF NOT EXISTS mail_templates (
  id          bigserial PRIMARY KEY,
  name        text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  subject     text NOT NULL DEFAULT '' CHECK (length(subject) <= 150),
  preheader   text NOT NULL DEFAULT '' CHECK (length(preheader) <= 150),
  -- info: bilgilendirme (hoş geldin, talep yayında); marketing: kampanya — yalnızca izin verenlere gider, abonelikten çıkma bağlantısı taşır
  kind        text NOT NULL DEFAULT 'info' CHECK (kind IN ('info', 'marketing')),
  blocks      jsonb NOT NULL DEFAULT '[]',
  theme       jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- görev: hangi şablon, hangi olayda (ya da hangi tarihte kime), ne kadar gecikmeyle
CREATE TABLE IF NOT EXISTS mail_rules (
  id           bigserial PRIMARY KEY,
  name         text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  template_id  bigint NOT NULL REFERENCES mail_templates(id) ON DELETE CASCADE,
  trigger      text NOT NULL CHECK (trigger IN ('signup', 'request_published', 'request_expired', 'no_request', 'once')),
  audience     text NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'buyers', 'sellers', 'corporate')),
  delay_min    integer NOT NULL DEFAULT 0 CHECK (delay_min BETWEEN 0 AND 129600),
  send_at      timestamptz,
  quiet_hours  boolean NOT NULL DEFAULT true,
  subject_b    text CHECK (subject_b IS NULL OR length(subject_b) <= 150),
  active       boolean NOT NULL DEFAULT false,
  fired_at     timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (trigger <> 'once' OR send_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS mail_sends (
  id           bigserial PRIMARY KEY,
  rule_id      bigint REFERENCES mail_rules(id) ON DELETE CASCADE,
  template_id  bigint NOT NULL REFERENCES mail_templates(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES users(id) ON DELETE CASCADE,
  -- olaya konu olan talep (talep yayına girdi / süresi doldu): {talep} ve {talepno} değişkenleri bundan doldurulur
  request_id   bigint REFERENCES requests(id) ON DELETE SET NULL,
  email        text NOT NULL,
  variant      char(1) NOT NULL DEFAULT 'A' CHECK (variant IN ('A', 'B')),
  subject      text,
  status       text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'skipped', 'test')),
  note         text,
  token        text NOT NULL UNIQUE,
  due_at       timestamptz NOT NULL DEFAULT now(),
  sent_at      timestamptz,
  opened_at    timestamptz,
  clicked_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
-- aynı görev aynı kişiye bir kez (talep vermeyen hatırlatması dahil; yeniden göndermek için görev kopyalanır)
CREATE UNIQUE INDEX IF NOT EXISTS mail_sends_rule_user_uq ON mail_sends (rule_id, user_id) WHERE rule_id IS NOT NULL AND user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS mail_sends_due ON mail_sends (due_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS mail_sends_rule ON mail_sends (rule_id, status);
CREATE INDEX IF NOT EXISTS mail_sends_user_sent ON mail_sends (user_id, sent_at);
