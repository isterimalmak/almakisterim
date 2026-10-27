-- Yönetimden düzenlenen içerik: kurumsal sayfalar (Hakkımızda, İletişim…), sözleşme metinlerinin sürümleri.
-- Alt bilgi (footer) settings.site_footer anahtarında; yoksa koddaki varsayılan kullanılır.
CREATE TABLE site_pages (
  slug        text PRIMARY KEY,
  title       text NOT NULL,
  body        text NOT NULL DEFAULT '',  -- Markdown (## başlık, - madde, **kalın**, [bağlantı](/yol))
  updated_at  timestamptz NOT NULL DEFAULT now()
);
INSERT INTO site_pages (slug, title, body) VALUES
  ('hakkimizda', 'Hakkımızda', E'almakisterim.com, Türkiye''nin alım talebi platformudur. İlan sitelerinde satıcı ilan verir, alıcı arar; almakisterim.com''da ise alıcı ne almak istediğini yazar, o ürün ya da hizmet elinde olan satıcılar talebi görüp alıcıya ulaşır.\n\n## Misyonumuz\n\nAlıcının aradığını saatlerce ilan arasında aramak yerine bir kez yazıp beklemesini; satıcının da gerçekten almak isteyen müşteriye doğrudan ulaşmasını sağlamak.\n\n## Nasıl çalışır?\n\n- **Alıcı** almak istediği ürünü ya da hizmeti, bütçesini ve konumunu yazar. Talep vermek ücretsizdir.\n- **Satıcı** elindeki ürüne uyan talepleri görür, alarm kurarak yeni taleplerden anında haberdar olur.\n- Satıcı alıcıya telefonla ya da site içi mesajla ulaşır; alışveriş taraflar arasında yapılır.\n\n## İlkelerimiz\n\n- **Gizlilik:** Alıcının telefon numarası talepte yazmaz; yalnızca talebiyle ilgilenen sınırlı sayıda satıcı görebilir.\n- **Güven:** Talepler ve mesajlar kurallara uygunluk açısından denetlenir; şikâyetler ekibimizce incelenir.\n- **Kolaylık:** Tek cümleyle talep verilir; yapay zekâ kategoriyi ve ayrıntıları sizin için doldurur.'),
  ('iletisim', 'İletişim', 'Sorularınız için önce [Sık Sorulan Sorular](/sss) sayfasına göz atabilirsiniz. Kişisel verilerinizle ilgili başvurular için [KVKK Başvuru Formu](/sozlesmeler/kvkk-basvuru-formu), içerik ve hak ihlali bildirimleri için [Hak İhlali Bildirimi](/sozlesmeler/hak-ihlali-bildirimi) sayfasındaki adımları izleyin.')
ON CONFLICT (slug) DO NOTHING;

-- Sözleşme metninin yönetimden kaydedilen her sürümü saklanır (onaylanan sürümün metni delil olarak gerekir).
-- Bir adres için en son kayıt yürürlüktedir; kayıt yoksa koddaki metin (sürüm 1.0) geçerlidir.
CREATE TABLE legal_versions (
  id          bigserial PRIMARY KEY,
  slug        text NOT NULL,
  version     text NOT NULL,
  effective   date NOT NULL,
  title       text NOT NULL,
  summary     text NOT NULL DEFAULT '',
  sections    jsonb NOT NULL,
  reconsent   boolean NOT NULL DEFAULT false, -- esaslı değişiklik: üyelerden yeniden onay istenir
  note        text,
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slug, version)
);
