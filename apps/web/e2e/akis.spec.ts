import { expect, test, type Page } from "@playwright/test";

const API = process.env.E2E_API_URL ?? "http://localhost:8080";
const rnd = () => String(Math.floor(Math.random() * 1e8)).padStart(8, "0");

async function loginSms(page: Page, phone: string, name: string) {
  await page.goto("/giris");
  await page.getByLabel("Cep telefonu", { exact: true }).fill(phone);
  await page.getByRole("button", { name: "SMS ile kod gönder" }).click();
  await expect(page.getByLabel("Doğrulama kodu")).toBeVisible();
  const to = "90" + phone.replace(/\D/g, "").replace(/^0/, "");
  const { text } = await (await page.request.get(`${API}/api/__test/last-message?to=${to}`)).json();
  await page.getByLabel("Doğrulama kodu").fill(text.match(/\d{6}/)[0]);
  await page.getByLabel("Adınız soyadınız (ilk girişte)").fill(name);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/giris"));
}

// Talep verirken zorunlu fotoğraf: 1x1 piksellik resim yüklenir.
async function addPhoto(page: Page) {
  await page.getByLabel("Fotoğraf / video ekle").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByAltText("Eklenen fotoğraf 1")).toBeVisible();
}

async function loginEmail(page: Page, email: string) {
  await page.goto("/giris");
  await page.getByRole("button", { name: "E-posta", exact: true }).click();
  await page.getByLabel("E-posta adresi").fill(email);
  await page.getByRole("button", { name: "E-posta ile kod gönder" }).click();
  await expect(page.getByLabel("Doğrulama kodu")).toBeVisible();
  const { text } = await (await page.request.get(`${API}/api/__test/last-message?to=${encodeURIComponent(email)}`)).json();
  await page.getByLabel("Doğrulama kodu").fill(text.match(/\d{6}/)[0]);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/giris"));
}

// Talep verirken SMS onayı: kayıtlı numara (numarası yoksa yeni bir numara) yazılır, gelen kod girilir.
async function smsOnay(page: Page) {
  const me = await (await page.request.get("/api/me")).json();
  const phone: string = (me.user ?? me).phone ?? `90505${rnd().slice(0, 7)}`;
  await page.getByLabel("Kayıtlı cep telefonunuz").fill("0" + phone.slice(2));
  await page.getByRole("button", { name: "Kod gönder" }).click();
  await expect(page.getByLabel("Telefona gelen doğrulama kodu")).toBeVisible();
  const { text } = await (await page.request.get(`${API}/api/__test/last-message?to=${phone}`)).json();
  await page.getByLabel("Telefona gelen doğrulama kodu").fill(text.match(/\d{6}/)[0]);
}

// Yönetici ayarını API ile değiştirir (ayrı tarayıcı oturumunda).
async function adminSetting(browser: import("@playwright/test").Browser, body: Record<string, unknown>) {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await loginEmail(p, "yonetici@almakisterim.com");
  const r = await p.request.put("/api/admin/settings", { data: body });
  expect(r.ok()).toBeTruthy();
  await ctx.close();
}

test("alıcı talep verir; satıcı numarayı görür, mesaj atar; alıcı cevaplar", async ({ browser }) => {
  const buyerCtx = await browser.newContext();
  const buyer = await buyerCtx.newPage();
  const title = `PS5 almak istiyorum ${rnd()}`;

  await loginSms(buyer, `0532${rnd().slice(0, 7)}`, "Elif Sönmez");
  await buyer.goto("/");
  await buyer.getByLabel("Ne almak istiyorsunuz?").fill(`${title}, bütçem 15 bin TL, Ankara`);
  await buyer.getByRole("button", { name: "Talep Oluştur" }).click();
  // Başlığı yapay zekâ (ya da yedek doldurucu) kendisi kurar; cümle kopyalanmaz. Test kendi benzersiz başlığını yazar.
  await expect(buyer.getByLabel("Talep başlığı *")).not.toHaveValue("");
  await buyer.getByLabel("Talep başlığı *").fill(title);
  await expect(buyer.getByLabel("En fazla bütçe (TL) *")).toHaveValue("15000");
  await expect(buyer.getByLabel("İl *")).toHaveValue("Ankara");
  // Fotoğraf zorunlu: fotoğrafsız devam edilemez.
  await buyer.getByRole("button", { name: "Devam" }).click();
  await expect(buyer.getByText("En az bir fotoğraf ekleyin", { exact: false })).toBeVisible();
  await expect(buyer.getByRole("button", { name: /Kendi fotoğrafını yükle/ })).toBeVisible();
  await addPhoto(buyer);
  await buyer.getByRole("button", { name: "Devam" }).click();
  await buyer.getByLabel(/kurallarını/).check();
  await smsOnay(buyer);
  await buyer.getByRole("button", { name: "Talebi Yayınla" }).click();
  await expect(buyer.getByRole("heading", { level: 1, name: title })).toBeVisible();
  const url = buyer.url();

  const sellerCtx = await browser.newContext();
  const seller = await sellerCtx.newPage();
  await loginSms(seller, `0533${rnd().slice(0, 7)}`, "Ahmet Kaya");
  await seller.goto(url);
  await seller.getByRole("button", { name: /Numarayı Gör/ }).click();
  await expect(seller.locator(".phone-open")).toBeVisible();
  await seller.getByLabel("Alıcıya mesajınız").fill("Merhaba, kutulu PS5 var, 2 kol. 14.250 TL.");
  await seller.getByRole("button", { name: "Gönder", exact: true }).click();
  await expect(seller.locator(".bub.me", { hasText: "kutulu PS5 var" })).toBeVisible();
  await expect(seller.getByRole("link", { name: "WhatsApp'tan yaz" })).toBeVisible();

  await buyer.reload();
  await expect(buyer.locator(".phone-hidden")).toContainText("1 / 10 satıcı gördü");
  await expect(buyer.getByRole("button", { name: "Rahatsız etti" })).toBeVisible();
  await expect(buyer.locator(".tabbar .badge, .hdr .badge").locator("visible=true").first()).toBeVisible();
  await expect(buyer.locator(".bub", { hasText: "kutulu PS5 var" })).toBeVisible();
  await buyer.getByLabel(/satıcısına cevap/).fill("Kollar orijinal mi?");
  await buyer.getByRole("button", { name: "Gönder", exact: true }).click();
  await expect(buyer.locator(".bub.me", { hasText: "Kollar orijinal mi?" })).toBeVisible();

  await seller.reload();
  await expect(seller.locator(".bub:not(.me)", { hasText: "Kollar orijinal mi?" })).toBeVisible();
  await seller.goto("/bana-ozel?s=mesaj");
  await expect(seller.getByText("Kollar orijinal mi?")).toBeVisible();
  await seller.goto("/bana-ozel?s=numaralar");
  await expect(seller.getByText(title)).toBeVisible();
  await buyerCtx.close(); await sellerCtx.close();
});

test("yönetici bir kategoriyi gizler ve sitede kaybolur", async ({ page }, info) => {
  // Aynı yönetici e-postasına dakikada bir kod gidebildiği için yalnızca masaüstünde çalışır.
  test.skip(info.project.name !== "masaustu");
  await loginEmail(page, "yonetici@almakisterim.com");
  await page.goto("/yonetim");
  // Panel açılınca genel bakış: sayaç kartları, grafikler, son hareketler.
  await expect(page.getByRole("heading", { level: 1, name: "Genel Bakış" })).toBeVisible();
  await expect(page.getByText("Toplam Üye")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Son 7 Gün — Yeni Üye" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Son Hareketler" })).toBeVisible();
  // Talepler bölümü: bütün talepler aranır.
  await page.getByRole("button", { name: "Talepler", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Talepler" })).toBeVisible();
  await page.getByLabel("Yönetimde talep ara").fill("istiyorum");
  await page.getByRole("button", { name: "Ara", exact: true }).last().click();
  await expect(page.locator(".ap-body .tbl tbody tr").first()).toBeVisible();
  // Bildirim Gönder: bütün üyelere site içi duyuru.
  await page.getByRole("button", { name: "Bildirim Gönder" }).click();
  await page.getByLabel("Bildirim metni *").fill(`Test duyurusu ${rnd()}`);
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Bildirimi gönder" }).click();
  await expect(page.getByText(/üyeye bildirim gönderildi/)).toBeVisible();
  // Entegrasyonlar: hangi hizmet bağlı görünür, anahtar görünmez.
  await page.getByRole("button", { name: "Entegrasyonlar" }).click();
  await expect(page.locator(".integ-card.on", { hasText: "Fotoğraf ve video deposu" })).toBeVisible();
  // Üyeler: liste kendiliğinden gelir, Excel'e indirilebilir.
  await page.getByRole("button", { name: "Üyeler ve Kredi" }).click();
  await expect(page.locator(".ap-body .tbl tbody tr").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Excel'e indir" })).toHaveAttribute("href", "/api/admin/users.csv");
  await page.getByRole("button", { name: "Kategoriler" }).click();
  const sw = page.getByRole("switch", { name: "Moda & Giyim" });
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "false");
  // Talep verirken bütün yayındaki kategoriler görünür; gizlenen görünmez.
  await page.goto("/talep-ver");
  await expect(page.locator(".cat-col").getByRole("button", { name: "Moda & Giyim" })).toHaveCount(0);
  await page.goto("/yonetim#kat");
  await page.getByRole("switch", { name: "Moda & Giyim" }).click();
  // Kayıt bitmeden sayfadan çıkılmasın.
  await expect(page.getByRole("switch", { name: "Moda & Giyim" })).toHaveAttribute("aria-checked", "true");
  await page.goto("/talep-ver");
  await expect(page.locator(".cat-col").getByRole("button", { name: "Moda & Giyim" })).toHaveCount(1);

  // Logonun yanındaki ad Ayarlar'dan değişir, üst kısımda hemen görünür; sonra eski hâline döner.
  await page.goto("/yonetim");
  await page.getByRole("button", { name: "Ayarlar" }).click();
  await page.getByLabel("Logonun yanında yazan ad").fill("deneme-adi.net");
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByText("Ayarlar kaydedildi.")).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("link", { name: "deneme-adi.net ana sayfa" }).locator("visible=true")).toBeVisible();
  await expect(page.locator(".logo img.logo-mark").first()).toHaveAttribute("src", "/logo.png");
  await page.goto("/yonetim");
  await page.getByRole("button", { name: "Ayarlar" }).click();
  await page.getByLabel("Logonun yanında yazan ad").fill("almakisterim.com");
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByText("Ayarlar kaydedildi.")).toBeVisible();

  // Acil talepler vitrini yönetimden açılıp kapanır.
  await page.goto("/yonetim");
  await page.getByRole("button", { name: "Ayarlar" }).click();
  const box = page.getByLabel(/Acil Alım Talepleri" vitrini/);
  await box.check();
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByText("Ayarlar kaydedildi.")).toBeVisible();
  expect((await (await page.request.get(`${API}/api/categories`)).json()).home_urgent_box).toBe(true);
  await box.uncheck();
  await Promise.all([page.waitForResponse((r) => r.url().includes("/api/admin/settings") && r.request().method() === "PUT"), page.getByRole("button", { name: "Kaydet" }).click()]);
  expect((await (await page.request.get(`${API}/api/categories`)).json()).home_urgent_box).toBe(false);

  // Hazır görsel galerisi: yönetici BMW 3 Serisi görseli ekler, talep veren bunu "Hazır görsellerden seç" ile ekler.
  const gtag = rnd();
  await page.goto("/yonetim");
  await page.getByRole("button", { name: "Hazır Görseller" }).click();
  await page.getByLabel("Kategori *").selectOption("otomobil");
  await page.getByLabel("Marka", { exact: true }).selectOption("BMW");
  await page.getByLabel("Model", { exact: true }).selectOption("3 Serisi");
  await page.getByLabel("Açıklama (isteğe bağlı)").fill(`beyaz ${gtag}`);
  await page.getByLabel("Galeri görseli seç").setInputFiles({ name: "bmw.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText("1 görsel galeriye eklendi.")).toBeVisible();
  await page.goto(`/talep-ver?metin=${encodeURIComponent("BMW 3 serisi almak istiyorum, bütçem 1 milyon TL, Ankara")}`);
  await expect(page.locator(".chip.on", { hasText: "BMW 3 Serisi" })).toBeVisible();
  // Girilen marka/modele uyan görseller fotoğraf bölümünde kendiliğinden çıkar.
  await expect(page.getByText("Talebinize uygun hazır görseller")).toBeVisible();
  await page.getByRole("button", { name: "Tümünü gör", exact: false }).click();
  await expect(page.getByRole("dialog", { name: "Hazır görsellerden seç" }).getByText("Vasıta › Otomobil")).toBeVisible();
  await page.getByRole("button", { name: "Kapat" }).click();
  await page.getByRole("button", { name: "BMW 3 Serisi görselini ekle" }).first().click();
  await expect(page.getByAltText("Eklenen fotoğraf 1")).toBeVisible();
  // Listeden marka seçilince ("Ekle"ye basmadan) hazır görseller o markaya göre değişir; başka markanın görseli çıkmaz.
  await page.getByRole("button", { name: /BMW 3 Serisi.*kaldır/ }).click();
  await page.getByLabel("Marka", { exact: true }).selectOption("Bentley");
  await expect(page.getByRole("button", { name: "BMW 3 Serisi görselini ekle" })).toHaveCount(0);
  await page.getByLabel("Marka", { exact: true }).selectOption("BMW");
  await expect(page.getByRole("button", { name: "BMW 3 Serisi görselini ekle" }).first()).toBeVisible();

  // Reklam alanı: resim yüklenir, başlık ve bağlantı verilir, ana sayfada soldaki kategorilerin altında görünür.
  const ad = `Galeri reklamı ${rnd()}`;
  await page.goto("/yonetim");
  await page.getByRole("button", { name: "Reklam Alanları" }).click();
  await page.getByLabel("Sol sütun (kategorilerin altı)").check();
  await page.getByLabel("Reklam dosyası seç").setInputFiles({ name: "reklam.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText("Reklam eklendi; ana sayfada görünüyor.")).toBeVisible();
  const n = await page.locator(".yk-satir").count();
  const titleBox = page.getByLabel(`${n}. reklam başlığı`);
  await titleBox.fill(ad);
  await page.getByLabel(`${n}. reklam bağlantısı`).fill("/kategori/vasita");
  await page.getByLabel(`${n}. reklam bağlantısı`).blur();
  await expect(page.getByLabel(`${n}. reklam bağlantısı`)).toHaveValue("/kategori/vasita");
  await page.waitForResponse((r) => r.url().includes("/api/admin/tanitim") && r.request().method() === "GET");
  await page.goto("/");
  const img = page.locator(".home-left .yk-list").getByAltText(ad);
  await expect(img).toBeVisible();
  await img.click();
  await page.waitForURL(/\/kategori\/vasita/);
  // Hangi cihazda: "Yalnız telefonda" seçilen reklam bilgisayarda görünmez, telefonda görünür; sonra "Her yerde"ye döner.
  const device = async (v: string) => {
    await page.goto("/yonetim");
    await page.getByRole("button", { name: "Reklam Alanları" }).click();
    await Promise.all([page.waitForResponse((r) => r.url().includes("/api/admin/tanitim/") && r.request().method() === "PATCH"), page.getByLabel(`${n}. reklamın cihazı`).selectOption({ label: v })]);
  };
  await device("Yalnız telefonda");
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".home-left .yk-list").getByAltText(ad)).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator(".yk-m").getByAltText(ad)).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await device("Her yerde (telefon ve bilgisayar)");
  // Karşılama: "Açılışta göster" işaretlenen reklam siteye girişte ortada açılır; kapatılınca aynı oturumda tekrar çıkmaz.
  await page.goto("/yonetim");
  await page.getByRole("button", { name: "Reklam Alanları" }).click();
  await Promise.all([page.waitForResponse((r) => r.url().includes("/api/admin/tanitim/") && r.request().method() === "PATCH"), page.getByLabel(`${n}. reklam açılışta göster`).check()]);
  await page.goto("/");
  const welcome = page.getByRole("dialog", { name: "Hoş geldiniz" });
  await expect(welcome.getByAltText(ad)).toBeVisible();
  await welcome.getByRole("button", { name: "Kapat" }).click();
  await expect(welcome).toHaveCount(0);
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(welcome).toHaveCount(0);
  // Temizlik: test reklamı silinir.
  page.on("dialog", (d) => void d.accept());
  await page.goto("/yonetim");
  await page.getByRole("button", { name: "Reklam Alanları" }).click();
  await page.locator(".yk-satir").nth(n - 1).getByRole("button", { name: "Sil" }).click();
  await expect(page.getByText("Reklam silindi.")).toBeVisible();

  // Video reklam sessiz başlar; köşedeki düğmeyle ses açılır ve kapanır.
  await page.getByLabel("Sol sütun (kategorilerin altı)").check();
  await page.getByLabel("Reklam dosyası seç").setInputFiles({ name: "reklam.mp4", mimeType: "video/mp4", buffer: Buffer.from("00000018667479706d703432", "hex") });
  await expect(page.getByText("Reklam eklendi; ana sayfada görünüyor.")).toBeVisible();
  await page.goto("/");
  const vid = page.locator(".home-left .yk-list .yk").filter({ has: page.locator("video") }).last();
  await expect(vid.locator("video")).toHaveJSProperty("muted", true);
  await vid.getByRole("button", { name: "Sesi aç" }).click();
  await expect(vid.locator("video")).toHaveJSProperty("muted", false);
  await vid.getByRole("button", { name: "Sesi kapat" }).click();
  await expect(vid.locator("video")).toHaveJSProperty("muted", true);
  await page.goto("/yonetim");
  await page.getByRole("button", { name: "Reklam Alanları" }).click();
  await page.locator(".yk-satir").last().getByRole("button", { name: "Sil" }).click();
  await expect(page.getByText("Reklam silindi.")).toBeVisible();

  // Yapay Zekâ bölümü: bağlı değilken uyarı çıkar, ayarlar kaydedilir; yönetici kendi yazısını yayınlar, blogda görünür.
  await page.getByRole("button", { name: "Yapay Zekâ" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Yapay Zekâ" })).toBeVisible();
  await expect(page.getByText("Yapay zekâ bağlı değil.")).toBeVisible();
  const msgSw = page.getByRole("switch", { name: "Mesajları denetle" });
  await expect(msgSw).toHaveAttribute("aria-checked", "true");
  // Ayar sunucuya kaydedilmeden sayfa yenilenmesin.
  await Promise.all([page.waitForResponse((r) => r.url().includes("/api/admin/") && r.request().method() !== "GET"), msgSw.click()]);
  await expect(msgSw).toHaveAttribute("aria-checked", "false");
  await page.reload();
  await expect(page.getByRole("switch", { name: "Mesajları denetle" })).toHaveAttribute("aria-checked", "false");
  await page.getByRole("switch", { name: "Mesajları denetle" }).click();
  await expect(page.getByRole("switch", { name: "Mesajları denetle" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: "Yapay zekâya yazdır" })).toBeDisabled();

  const title = `Güvenli alışveriş rehberi ${rnd()}`;
  await page.getByRole("button", { name: "Kendim yazayım" }).click();
  await page.getByLabel("Başlık", { exact: true }).fill(title);
  await page.getByLabel("Kısa özet").fill("Kapora vermeden alışveriş");
  await page.locator("#e-body").fill("## Ürünü görmeden para göndermeyin\nSatıcıyla yüz yüze buluşun.\n\n- **Kapora** istenirse vazgeçin\n- Faturayı isteyin");
  await page.getByRole("button", { name: "Yayınla", exact: true }).click();
  await expect(page.getByText("Yazı yayınlandı.")).toBeVisible();

  await page.goto("/blog");
  await page.getByRole("link", { name: new RegExp(title) }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Ürünü görmeden para göndermeyin" })).toBeVisible();
  await expect(page.locator(".md strong", { hasText: "Kapora" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ücretsiz Talep Ver" }).last()).toBeVisible();

  await page.goto("/yonetim#yz");
  await page.getByRole("row").filter({ hasText: title }).getByRole("button", { name: "Sil" }).click();
  await expect(page.getByText("Silindi.")).toBeVisible();
  await page.goto("/blog");
  await expect(page.getByText(title)).toHaveCount(0);

  // Entegrasyonlar: anahtar panelden girilir, kaydedilince bir daha gösterilmez; test düğmesi eksik olanı söyler; silinince eski haline döner.
  await page.goto("/yonetim#ent");
  const card = page.locator(".integ-card").filter({ hasText: "Google ile giriş" });
  await card.getByLabel("İstemci kimliği").fill("deneme-kimlik.apps.googleusercontent.com");
  await card.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByText("Kaydedildi.")).toBeVisible();
  await expect(card.getByLabel("İstemci kimliği")).toHaveValue("deneme-kimlik.apps.googleusercontent.com");
  await card.getByRole("button", { name: "Test et" }).click();
  await expect(card.getByText("İstemci kimliği ve gizli anahtar girilmeli.")).toBeVisible();
  await card.getByLabel("İstemci gizli anahtarı").fill("cok-gizli-deger-123");
  await card.getByRole("button", { name: "Kaydet" }).click();
  await expect(card.getByLabel("İstemci gizli anahtarı")).toHaveValue("");
  await expect(card.getByLabel("İstemci gizli anahtarı")).toHaveAttribute("placeholder", /kayıtlı/);
  await page.reload();
  expect(await page.content()).not.toContain("cok-gizli-deger-123");
  for (const label of ["İstemci gizli anahtarı", "İstemci kimliği"]) {
    await card.locator(".fg").filter({ has: page.getByLabel(label) }).getByRole("button", { name: "Sil" }).click();
    await expect(page.getByText("Silindi.").last()).toBeVisible();
  }
  await expect(card.getByText("Bağlı değil")).toBeVisible();

  // Ana sayfa bölümleri: vitrin ve son talepler gizlenir; ortaya resim reklamı eklenir, vitrinin yerinde görünür.
  await page.goto("/yonetim");
  await page.getByRole("button", { name: "Reklam Alanları" }).click();
  await page.getByRole("button", { name: "Vitrini gizle" }).click();
  await expect(page.getByText("Ana Sayfa Vitrini ana sayfada gizlendi.")).toBeVisible();
  await page.getByRole("button", { name: "Son talepleri gizle" }).click();
  await expect(page.getByRole("button", { name: "Son talepleri göster" })).toBeVisible();
  await page.getByLabel("Ana sayfanın ortası (vitrin yeri)").check();
  await page.getByLabel("Reklam dosyası seç").setInputFiles({ name: "orta-reklam.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText("Reklam eklendi", { exact: false })).toBeVisible();
  await page.goto("/");
  await expect(page.locator(".yk-orta img[alt='orta-reklam']").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ana Sayfa Vitrini" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Son Eklenen Talepler" })).toHaveCount(0);
  // Yönetici ana sayfada gizli bölümü görür ve oradan geri açar; bölümün üstündeki "Gizle" ile yine gizler.
  await page.getByRole("button", { name: "Son Eklenen Talepler: göster" }).click();
  await expect(page.getByRole("heading", { name: "Son Eklenen Talepler" })).toBeVisible();
  await page.getByRole("button", { name: "Son Eklenen Talepler bölümünü gizle" }).click();
  await expect(page.getByRole("heading", { name: "Son Eklenen Talepler" })).toHaveCount(0);
  // Ziyaretçi gizli bölümü ve yönetici düğmelerini görmez.
  const guest = await (await page.context().browser()!.newContext()).newPage();
  await guest.goto("/");
  await expect(guest.getByRole("heading", { name: "Son Eklenen Talepler" })).toHaveCount(0);
  await expect(guest.getByRole("button", { name: /bölümünü gizle|: göster/ })).toHaveCount(0);
  await guest.context().close();
  // Eski hâline döner (diğer testler vitrini ve listeyi kullanıyor); eklenen reklam silinir.
  await page.goto("/yonetim");
  await page.getByRole("button", { name: "Reklam Alanları" }).click();
  await page.getByRole("button", { name: "Vitrini göster" }).click();
  await expect(page.getByRole("button", { name: "Vitrini gizle" })).toBeVisible();
  await page.getByRole("button", { name: "Son talepleri göster" }).click();
  await expect(page.getByRole("button", { name: "Son talepleri gizle" })).toBeVisible();
  // Ana Sayfa Düzeni (Marka Bahçem vitrini gibi): son talepler en üste taşınır; yazı ve kayan yazı bölümü eklenir.
  const htag = rnd();
  await page.getByRole("button", { name: "Ana Sayfa Düzeni" }).click();
  for (let i = 0; i < 6; i++) await Promise.all([page.waitForResponse((r) => r.url().includes("/api/categories")), page.getByRole("button", { name: "Son Eklenen Talepler yukarı taşı" }).click()]);
  await expect(page.getByRole("button", { name: "Son Eklenen Talepler yukarı taşı" })).toBeDisabled();
  await page.getByRole("button", { name: /Yazı \/ duyuru/ }).click();
  await page.getByLabel("Başlık", { exact: true }).fill(`Hoş geldiniz ${htag}`);
  await page.getByLabel("Metin").fill("Almak istediğinizi yazın, satıcılar size gelsin.");
  await page.getByLabel("Düğme yazısı (isteğe bağlı)").fill("Ücretsiz talep ver");
  await page.getByLabel("Düğmenin gideceği adres").fill("/talep-ver");
  // Kayıt sunucuya ulaşmadan sayfadan ayrılmamak için her kaydın cevabı beklenir.
  await Promise.all([page.waitForResponse((r) => r.url().includes("/api/admin/home-blocks") && r.request().method() === "PUT"), page.getByRole("button", { name: "Kaydet", exact: true }).click()]);
  await expect(page.getByText(`Yazı: Hoş geldiniz ${htag}`)).toBeVisible();
  await Promise.all([page.waitForResponse((r) => r.url().includes("/api/admin/home-blocks") && r.request().method() === "PUT"), page.getByRole("button", { name: /Kayan yazı bandı/ }).click()]);
  await expect(page.getByText("Kayan yazı: Almak istediğinizi yazın", { exact: false })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: `Hoş geldiniz ${htag}` })).toBeVisible();
  await expect(page.locator(".hb-text").getByRole("link", { name: "Ücretsiz talep ver" })).toHaveAttribute("href", "/talep-ver");
  await expect(page.locator(".hb-mq").first()).toBeVisible();
  const [latestY, heroY] = await Promise.all([page.getByRole("heading", { name: "Son Eklenen Talepler" }).boundingBox(), page.getByRole("heading", { name: "Ne almak istiyorsunuz?" }).boundingBox()]);
  expect(latestY!.y).toBeLessThan(heroY!.y);
  // Temizlik: eklenen bölümler silinir, hazır bölümler ilk sıraya döner.
  await page.goto("/yonetim");
  await page.getByRole("button", { name: "Ana Sayfa Düzeni" }).click();
  await page.getByRole("button", { name: `Yazı: Hoş geldiniz ${htag} sil` }).click();
  await expect(page.getByText(`Yazı: Hoş geldiniz ${htag}`)).toHaveCount(0);
  await page.getByRole("button", { name: /^Kayan yazı: .* sil$/ }).first().click();
  await expect(page.getByText("Bölüm silindi.").last()).toBeVisible();
  // Hazır bölümün adına tıklayınca düzenleme açılır: talep kutusunun başlığı değişir, ana sayfada görünür, sonra varsayılana döner.
  await page.getByRole("button", { name: "Talep kutusu (Ne almak istiyorsunuz?) düzenle" }).click();
  await page.getByLabel("Başlık", { exact: true }).fill(`Neyi arıyorsunuz ${htag}?`);
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.getByText("Kaydedildi.").last()).toBeVisible();
  await expect(page.locator(".hl-frame iframe")).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: `Neyi arıyorsunuz ${htag}?` })).toBeVisible();
  await page.goto("/yonetim");
  await page.getByRole("button", { name: "Ana Sayfa Düzeni" }).click();
  await page.getByRole("button", { name: "Talep kutusu (Ne almak istiyorsunuz?) düzenle" }).click();
  await page.getByRole("group", { name: /nerede görünsün/ }).getByRole("button", { name: "Bilgisayarda" }).click();
  await expect(page.getByText("bilgisayarda görünür.", { exact: false }).last()).toBeVisible();
  await page.getByRole("group", { name: /nerede görünsün/ }).getByRole("button", { name: "Her yerde" }).click();
  await page.getByRole("button", { name: "Varsayılan yazılara dön" }).click();
  await expect(page.getByLabel("Başlık", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Hazır bölümleri ilk sıraya döndür" }).click();
  await expect(page.getByRole("button", { name: "Talep kutusu (Ne almak istiyorsunuz?) yukarı taşı" })).toBeDisabled();
  await page.getByRole("button", { name: "Reklam Alanları", exact: true }).click();
  const row = page.locator(".yk-satir").filter({ has: page.locator("input[value='orta-reklam']") });
  await row.first().getByRole("button", { name: "Sil" }).click();
  await expect(page.getByText("Reklam silindi.")).toBeVisible();
});

test("telefonda yan kutular (Nasıl çalışır?, Güvenli alışveriş) bölüm listesinde, bilgisayarda sağ sütunda tek kez görünür", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Nasıl çalışır?" }).locator("visible=true")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Güvenli alışveriş" }).locator("visible=true")).toHaveCount(1);
});

test("talep verirken tarayıcının geri tuşu bir önceki adıma döner, bilgiler kaybolmaz", async ({ page }) => {
  const title = `Geri tuşu bisiklet ${rnd()}`;
  await loginSms(page, `0536${rnd().slice(0, 7)}`, "Geri Deneme");
  await page.goto("/");
  await page.getByLabel("Ne almak istiyorsunuz?").first().fill(`${title}, bütçem 9 bin TL, Ankara`);
  await page.getByRole("button", { name: "Talep Oluştur" }).first().click();
  await expect(page.getByLabel("Talep başlığı *")).not.toHaveValue("");
  // Başlık alım talebi gibi kurulur.
  await expect(page.getByLabel("Talep başlığı *")).toHaveValue(/Talebi$/);
  await page.getByLabel("Talep başlığı *").fill(title);
  await addPhoto(page);
  await page.getByRole("button", { name: "Devam" }).click();
  await expect(page.getByRole("heading", { name: "Talebinizin önizlemesi" })).toBeVisible();
  await expect(page).toHaveURL(/adim=3/);
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Talep Detayları" })).toBeVisible();
  await expect(page.getByLabel("Talep başlığı *")).toHaveValue(title);
  await expect(page).toHaveURL(/talep-ver/);
  await page.goForward();
  await expect(page.getByRole("heading", { name: "Talebinizin önizlemesi" })).toBeVisible();
  // Sayfadaki "Geri" düğmesi de bir önceki adıma döner; sonra tarayıcının geri tuşu ilk adıma.
  await page.getByRole("button", { name: "Geri", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Talep Detayları" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Kategori seçin" })).toBeVisible();
  await expect(page).toHaveURL(/talep-ver/);
});

test("yeni talep ana sayfa vitrininde kutucuk olarak görünür", async ({ page }) => {
  const title = `Vitrin bisiklet ${rnd()}`;
  await loginSms(page, `0536${rnd().slice(0, 7)}`, "Deniz Kaya");
  await page.goto(`/talep-ver?metin=${encodeURIComponent(`${title}, bütçem 9 bin TL, Ankara`)}`);
  // Başlığı yapay zekâ (ya da yedek doldurucu) kendisi kurar; cümle kopyalanmaz. Test kendi benzersiz başlığını yazar.
  await expect(page.getByLabel("Talep başlığı *")).not.toHaveValue("");
  await page.getByLabel("Talep başlığı *").fill(title);
  await page.getByLabel("Fotoğraf / video ekle").setInputFiles({ name: "v.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByAltText("Eklenen fotoğraf 1")).toBeVisible();
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByLabel(/kurallarını/).check();
  await smsOnay(page);
  await page.getByRole("button", { name: "Talebi Yayınla" }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Ana Sayfa Vitrini" })).toBeVisible();
  const tile = page.locator(".vt").getByTitle(title);
  await expect(tile).toBeVisible();
  await tile.click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  // Talep sayfası: başlık kartında "Alım Talebi" etiketi ve bütçe; aşağı kaydırınca özet çubuğu belirir; galeride sayaç.
  await expect(page.locator(".rq-head").getByText("Alım Talebi")).toBeVisible();
  await expect(page.locator(".rq-head .rq-budget")).toContainText("TL");
  await expect(page.locator(".gal-count")).toHaveText(/1\/1/);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator(".rq-stick")).not.toHaveClass(/\bon\b/);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.locator(".rq-stick")).toHaveClass(/\bon\b/);
  await expect(page.locator(".rq-stick")).toContainText(title);
});

test("yönetici kayan vitrin ekler: adını, talebini ve hızını seçer; ana sayfada talepler sağdan sola akar", async ({ page, browser }, info) => {
  // Yönetim paneli testleri yalnızca masaüstünde çalışır.
  test.skip(info.project.name !== "masaustu");
  // Vitrine eklenecek talep
  const title = `Kayan vitrin bisiklet ${rnd()}`;
  const buyerCtx = await browser.newContext();
  const buyer = await buyerCtx.newPage();
  await loginSms(buyer, `0536${rnd().slice(0, 7)}`, "Vitrin Alıcı");
  await buyer.goto(`/talep-ver?metin=${encodeURIComponent(`${title}, bütçem 9 bin TL, Ankara`)}`);
  await expect(buyer.getByLabel("Talep başlığı *")).not.toHaveValue("");
  await buyer.getByLabel("Talep başlığı *").fill(title);
  await addPhoto(buyer);
  await buyer.getByRole("button", { name: "Devam" }).click();
  await buyer.getByLabel(/kurallarını/).check();
  await smsOnay(buyer);
  await buyer.getByRole("button", { name: "Talebi Yayınla" }).click();
  await expect(buyer.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await buyerCtx.close();

  const name = `Haftanın Talepleri ${rnd()}`;
  const saved = () => page.waitForResponse((r) => r.url().includes("/api/admin/home-blocks") && r.request().method() === "PUT");
  await loginEmail(page, "yonetici@almakisterim.com");
  await page.goto("/yonetim");
  await page.getByRole("button", { name: "Ana Sayfa Düzeni" }).click();
  await Promise.all([saved(), page.getByRole("button", { name: /Kayan vitrin/ }).click()]);
  await page.getByLabel("Vitrinin adı").fill(name);
  await Promise.all([saved(), page.getByLabel("Vitrinin adı").blur()]);
  await Promise.all([saved(), page.getByRole("button", { name: "Hızlı", exact: true }).click()]);
  await page.getByLabel("Vitrine eklenecek talebi ara").fill(title);
  await page.getByRole("button", { name: "Ara", exact: true }).last().click();
  await Promise.all([saved(), page.getByRole("button", { name: `${title} vitrine ekle` }).click()]);
  await expect(page.getByRole("button", { name: `${title} vitrinden çıkar` })).toBeVisible();
  await expect(page.getByText(`Kayan vitrin: ${name} (1 talep)`)).toBeVisible();

  await page.goto("/");
  const sec = page.getByRole("region", { name });
  await expect(sec.getByRole("heading", { name })).toBeVisible();
  await expect(sec.getByTitle(title).first()).toBeVisible();
  // Şerit hareket ediyor: kayma animasyonu var ve süresi seçilen hıza göre.
  const anim = await sec.locator(".sc-track").evaluate((e) => ({ name: getComputedStyle(e).animationName, dur: parseFloat(getComputedStyle(e).animationDuration) }));
  expect(anim.name).toBe("sc-move");
  expect(anim.dur).toBeCloseTo(2.4 * 8, 1);

  // Temizlik: kayan vitrin silinir.
  const { home_blocks } = await (await page.request.get("/api/categories")).json();
  const r = await page.request.put("/api/admin/home-blocks", { data: { blocks: home_blocks.filter((b: { type: string }) => b.type !== "showcase") } });
  expect(r.ok()).toBeTruthy();
});

test("telefonda ana sayfa: üstte arama ve bildirim, kategoriler ve vitrin yana kayar", async ({ page }, info) => {
  test.skip(info.project.name !== "telefon", "yalnız telefon görünümü");
  await page.goto("/");
  await expect(page.locator(".mob-search").getByLabel("Talep ara")).toBeVisible();
  await expect(page.locator(".mob-search").getByRole("link", { name: "Bildirimler" })).toBeVisible();
  // Kutucuklar ve vitrin kartları tek satırda, yana kaydırılarak gezilir.
  for (const sel of [".cat-tiles", ".vt-home"]) {
    const el = page.locator(sel);
    await expect(el).toBeVisible();
    expect(await el.evaluate((e) => getComputedStyle(e).overflowX)).toBe("auto");
  }
  await page.locator(".mob-search").getByLabel("Talep ara").fill("laptop");
  await page.locator(".mob-search").getByRole("button", { name: "Ara" }).click();
  await expect(page).toHaveURL(/kategori\?q=laptop/);
});

test("talepler listesi: lacivert başlık kartı; telefonda talepler yuvarlak kart, bütçe turuncu şeritte", async ({ page }, info) => {
  await page.goto("/kategori");
  const hero = page.locator(".lst-hero");
  await expect(hero.getByText("Alım Talepleri", { exact: true })).toBeVisible();
  await expect(hero.getByRole("heading", { level: 1 })).toBeVisible();
  const row = page.locator(".rq-tbl tr.row").first();
  await expect(row).toBeVisible();
  if (info.project.name === "telefon") {
    expect(parseFloat(await row.evaluate((e) => getComputedStyle(e).borderTopLeftRadius))).toBeGreaterThan(8);
    expect(await row.locator(".budget").evaluate((e) => getComputedStyle(e).display)).toBe("flex");
  }
});

test("sayfalar yana taşmıyor", async ({ page }) => {
  for (const p of ["/", "/kategori", "/kategori/vasita", "/talep-ver", "/giris", "/sayfa/kvkk", "/guvenli-al"]) {
    await page.goto(p);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, p).toBeLessThanOrEqual(0);
  }
});

// 1x1 piksel PNG: gerçek bir resim dosyası gibi yüklenir.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("alıcı fotoğraf ekler; satıcı talepte fotoğrafı görür, iletişimi açar", async ({ browser }) => {
  const buyerCtx = await browser.newContext();
  const buyer = await buyerCtx.newPage();
  const title = `Bisiklet almak istiyorum ${rnd()}`;
  await loginSms(buyer, `0534${rnd().slice(0, 7)}`, "Zeynep Ak");
  await buyer.goto("/");
  await buyer.getByLabel("Ne almak istiyorsunuz?").fill(`${title}, bütçem 8 bin TL, İzmir`);
  await buyer.getByRole("button", { name: "Talep Oluştur" }).click();
  // Başlığı yapay zekâ (ya da yedek doldurucu) kendisi kurar; cümle kopyalanmaz. Test kendi benzersiz başlığını yazar.
  await expect(buyer.getByLabel("Talep başlığı *")).not.toHaveValue("");
  await buyer.getByLabel("Talep başlığı *").fill(title);
  await buyer.getByLabel("Fotoğraf / video ekle").setInputFiles({ name: "ornek.png", mimeType: "image/png", buffer: PNG });
  await expect(buyer.getByAltText("Eklenen fotoğraf 1")).toBeVisible();
  await expect(buyer.getByText("Kapak", { exact: true })).toBeVisible();
  await buyer.getByRole("button", { name: "Devam" }).click();
  await expect(buyer.getByAltText("Talep fotoğrafı")).toBeVisible();
  await buyer.getByLabel(/kurallarını/).check();
  await smsOnay(buyer);
  await buyer.getByRole("button", { name: "Talebi Yayınla" }).click();
  await expect(buyer.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(buyer.getByAltText("Talep fotoğrafı")).toBeVisible();
  const url = buyer.url();

  const sellerCtx = await browser.newContext();
  const seller = await sellerCtx.newPage();
  await loginSms(seller, `0535${rnd().slice(0, 7)}`, "Can Yıldız");
  await seller.goto(url);
  await expect(seller.getByAltText("Talep fotoğrafı")).toBeVisible();
  // Fotoğrafa dokununca ayrı sayfaya gitmez; sayfanın içinde tam ekran açılır, × ile kapanır.
  const before = seller.url();
  await seller.getByRole("button", { name: "Fotoğrafı büyüt" }).click();
  const lbx = seller.getByRole("dialog", { name: "Fotoğraf görüntüleyici" });
  await expect(lbx.getByAltText("Fotoğraf 1")).toBeVisible();
  expect(seller.url()).toBe(before);
  await lbx.getByRole("button", { name: "Kapat" }).click();
  await expect(lbx).toHaveCount(0);
  await seller.getByRole("button", { name: /Numarayı Gör/ }).click();
  await expect(seller.locator(".phone-open")).toBeVisible();
  await buyerCtx.close(); await sellerCtx.close();
});

test("boş kategori gezinirken görünmez; açılırsa boş liste yerine yönlendirme çıkar", async ({ page }) => {
  await page.goto("/");
  // Henüz talebi olmayan kategori menüde yok, talep verirken var.
  await expect(page.locator(".subnav").getByText("Anne & Bebek")).toHaveCount(0);
  await page.goto("/kategori/bebek");
  await expect(page.getByText("için talepler yakında burada")).toBeVisible();
  await expect(page.getByRole("link", { name: "Talep gelince haber ver" })).toHaveAttribute("href", "/bana-ozel?s=alarm");
  await expect(page.getByText("0 talep bulundu")).toHaveCount(0);
  await page.goto("/talep-ver");
  await expect(page.locator(".cat-col").getByRole("button", { name: "Anne & Bebek" })).toHaveCount(1);
});

test("alıcı birden fazla araç seçer, satıcı elindeki araca uyan talebi bulur", async ({ browser }) => {
  const ctx = await browser.newContext();
  const buyer = await ctx.newPage();
  const tag = rnd();
  await loginSms(buyer, `0536${rnd().slice(0, 7)}`, "Burak Er");
  await buyer.goto("/");
  await buyer.getByLabel("Ne almak istiyorsunuz?").fill(`BMW 3 serisi veya Audi A4 almak istiyorum ${tag}, 2018 sonrası, dizel otomatik, bütçem 1,5 milyon TL, İstanbul`);
  await buyer.getByRole("button", { name: "Talep Oluştur" }).click();
  await expect(buyer.locator(".chip.on", { hasText: "BMW 3 Serisi" })).toBeVisible();
  await expect(buyer.locator(".chip.on", { hasText: "Audi A4" })).toBeVisible();
  await expect(buyer.getByLabel("Model yılı (en eski)")).toHaveValue("2018");
  await expect(buyer.getByRole("button", { name: "Otomatik", exact: true })).toHaveAttribute("aria-pressed", "true");
  // Başlık cümle kopyalanmadan araçlardan kurulur; test sonunda bulmak için etiketi ekler.
  await expect(buyer.getByLabel("Talep başlığı *")).toHaveValue("1,5 Milyon TL Bütçeli 2018 ve Sonrası Dizel Otomatik BMW 3 Serisi veya Audi A4 Alım Talebi");
  await buyer.getByLabel("Talep başlığı *").fill(`BMW 3 Serisi veya Audi A4 ${tag}`);
  // Üçüncü araç elle eklenir.
  await buyer.getByLabel("Marka", { exact: true }).selectOption("Mercedes-Benz");
  await buyer.getByLabel("Model", { exact: true }).selectOption("C Serisi");
  await buyer.getByRole("button", { name: "+ Ekle" }).click();
  await expect(buyer.locator(".chip.on", { hasText: "Mercedes-Benz C Serisi" })).toBeVisible();
  // Üç araç seçildi: her biri ayrı talep olacak, her araca kendi fotoğrafı eklenir (fotoğraf zorunlu).
  await expect(buyer.getByText("3 araç seçtiniz; her biri ayrı talep olarak yayınlanacak.")).toBeVisible();
  await buyer.getByRole("button", { name: "Devam" }).click();
  await expect(buyer.getByText("BMW 3 Serisi için kendi fotoğrafınızı", { exact: false })).toBeVisible();
  for (const [i, car] of ["BMW 3 Serisi", "Audi A4", "Mercedes-Benz C Serisi"].entries()) {
    await buyer.getByLabel(`${car} için fotoğraf ekle`).setInputFiles({ name: `foto${i}.png`, mimeType: "image/png", buffer: PNG });
    await expect(buyer.locator(".car-photo", { hasText: `${car} fotoğrafı` }).getByAltText("Eklenen fotoğraf 1")).toBeVisible();
  }
  await buyer.getByRole("button", { name: "Devam" }).click();
  await expect(buyer.getByText("3 ayrı talep yayınlanacak:")).toBeVisible();
  await buyer.getByLabel(/kurallarını/).check();
  await smsOnay(buyer);
  await buyer.getByRole("button", { name: "Talebi Yayınla" }).click();
  // İlk aracın talebi açılır; diğer iki araç ayrı talep olarak bağlantılı görünür.
  await expect(buyer.getByRole("heading", { level: 1 })).toContainText("BMW 3 Serisi");
  await expect(buyer.getByRole("heading", { level: 1 })).not.toContainText("Audi");
  const audi = buyer.getByRole("link", { name: /Audi A4/ });
  await expect(audi).toBeVisible();
  await expect(buyer.getByRole("link", { name: /Mercedes-Benz C Serisi/ })).toBeVisible();
  const audiHref = (await audi.getAttribute("href"))!;

  const seller = await (await browser.newContext()).newPage();
  await seller.goto("/kategori/vasita");
  // Telefonda filtreler "Filtrele" düğmesinin arkasında.
  const toggle = seller.getByRole("button", { name: "Filtrele", exact: true });
  if (await toggle.isVisible()) await toggle.click();
  await seller.getByLabel("Aracın markası").selectOption("Audi");
  await seller.getByLabel("Aracın modeli").selectOption("A4");
  await seller.getByLabel("Aracın yılı").fill("2020");
  await expect(seller.locator(`.tbl-wrap a[href="${audiHref}"]`).first()).toBeVisible();
  // 2015 model araç "2018 sonrası" talebine uymaz; ana listede çıkmaz (alttaki "diğer talepler"de görünebilir).
  await seller.getByLabel("Aracın yılı").fill("2015");
  await expect(seller.locator(`.tbl-wrap a[href="${audiHref}"]`)).toHaveCount(0);
  await ctx.close();
});

test("telefon zorunlu değilken e-postayla giren alıcı telefonsuz talep verir; satıcı mesajla ulaşır", async ({ browser }, info) => {
  // Yönetici ayarı değiştirildiği için (yönetici e-postasına saatte 5 kod) yalnızca masaüstünde çalışır.
  test.skip(info.project.name !== "masaustu");
  // Bu senaryo için talep verirken SMS onayı kapatılır, sonda yeniden açılır.
  await adminSetting(browser, { publish_sms: false });
  try { await phoneless(browser); } finally { await adminSetting(browser, { publish_sms: true }); }
});

async function phoneless(browser: import("@playwright/test").Browser) {
  const buyerCtx = await browser.newContext();
  const buyer = await buyerCtx.newPage();
  const title = `Telefonsuz talep ${rnd()}`;
  await loginEmail(buyer, `alici${rnd()}@example.com`);
  await buyer.goto(`/talep-ver?metin=${encodeURIComponent(`${title}, bütçem 5 bin TL, Bursa`)}`);
  // Başlığı yapay zekâ (ya da yedek doldurucu) kendisi kurar; cümle kopyalanmaz. Test kendi benzersiz başlığını yazar.
  await expect(buyer.getByLabel("Talep başlığı *")).not.toHaveValue("");
  await buyer.getByLabel("Talep başlığı *").fill(title);
  await addPhoto(buyer);
  await buyer.getByRole("button", { name: "Devam" }).click();
  await expect(buyer.getByText("Telefon numaranızı doğrulayın.")).toHaveCount(0);
  await buyer.getByLabel(/kurallarını/).check();
  await buyer.getByRole("button", { name: "Talebi Yayınla" }).click();
  await expect(buyer.getByRole("heading", { level: 1, name: title })).toBeVisible();
  const url = buyer.url();

  const sellerCtx = await browser.newContext();
  const seller = await sellerCtx.newPage();
  await loginEmail(seller, `satici${rnd()}@example.com`);
  await seller.goto(url);
  await seller.getByRole("button", { name: /Numarayı Gör/ }).click();
  await expect(seller.getByText("Alıcı telefon numarası eklememiş.", { exact: false })).toBeVisible();
  await seller.getByLabel("Alıcıya mesajınız").fill("Merhaba, elimde uygun ürün var.");
  await seller.getByRole("button", { name: "Gönder", exact: true }).click();
  await expect(seller.locator(".bub.me", { hasText: "elimde uygun ürün var" })).toBeVisible();
  await buyer.goto("/bana-ozel?s=mesaj");
  await expect(buyer.getByText("elimde uygun ürün var")).toBeVisible();
  await buyerCtx.close(); await sellerCtx.close();
}

test("talep yayınlamadan önce SMS onayı: başka numaraya kod gitmez, kod girilmeden yayınlanmaz", async ({ page }) => {
  const phone = `0536${rnd().slice(0, 7)}`;
  await loginSms(page, phone, "Onay Deneme");
  const title = `SMS onaylı bisiklet ${rnd()}`;
  await page.goto(`/talep-ver?metin=${encodeURIComponent(`${title}, bütçem 9 bin TL, Ankara`)}`);
  await expect(page.getByLabel("Talep başlığı *")).not.toHaveValue("");
  await page.getByLabel("Talep başlığı *").fill(title);
  await addPhoto(page);
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByLabel(/kurallarını/).check();
  await expect(page.getByText("Cep telefonu onayı")).toBeVisible();
  await page.getByRole("button", { name: "Talebi Yayınla" }).click();
  await expect(page.getByText("Önce cep telefonunuzu yazıp doğrulama kodu isteyin.")).toBeVisible();
  await page.getByLabel("Kayıtlı cep telefonunuz").fill("0505 000 00 00");
  await page.getByRole("button", { name: "Kod gönder" }).click();
  await expect(page.getByText(/Hesabınızda kayıtlı numarayı yazın/)).toBeVisible();
  await smsOnay(page);
  await page.getByRole("button", { name: "Talebi Yayınla" }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
});

test("site uygulama gibi yüklenebilir; telefonda alt menü çalışır", async ({ page }, info) => {
  const m = await (await page.request.get("/manifest.webmanifest")).json();
  expect(m).toMatchObject({ short_name: "almakisterim", display: "standalone", lang: "tr" });
  expect((await page.request.get("/icons/icon-512.png")).status()).toBe(200);
  expect((await page.request.get("/sw.js")).status()).toBe(200);
  await page.goto("/");
  const bar = page.getByRole("navigation", { name: "Uygulama menüsü" });
  if (info.project.name !== "telefon") { await expect(bar).toBeHidden(); return; }
  await expect(bar).toBeVisible();
  // Telefonda üstteki kategori şeridi gösterilmez (ana sayfa kutucukları ve alt menü var).
  await expect(page.locator(".subnav")).toBeHidden();
  await bar.getByRole("link", { name: "Talepler" }).click();
  await page.waitForURL(/\/kategori/);
  await bar.getByRole("link", { name: "Talep Ver" }).click();
  await page.waitForURL(/\/talep-ver/);
});

test("alıcı il/ilçe/mahalle seçer; satıcı İstanbul → Kadıköy diye arayınca bulur, Üsküdar'da bulmaz", async ({ browser }) => {
  const ctx = await browser.newContext();
  const buyer = await ctx.newPage();
  const tag = rnd();
  await loginSms(buyer, `0537${rnd().slice(0, 7)}`, "Selin Ak");
  await buyer.goto(`/talep-ver?metin=${encodeURIComponent(`Kadıköy'de satılık ev almak istiyorum ${tag}, bütçem 8 milyon TL`)}`);
  await expect(buyer.getByLabel("İl *")).toHaveValue("İstanbul");
  await expect(buyer.getByLabel("İlçe")).toHaveValue("Kadıköy");
  await expect(buyer.getByLabel("Talep başlığı *")).toHaveValue("Kadıköy'de 8 Milyon TL Bütçeli Daire Alım Talebi");
  await buyer.getByLabel("Talep başlığı *").fill(`Kadıköy'de satılık ev ${tag}`);
  await buyer.getByLabel("Mahalle").selectOption("Caferağa");
  await addPhoto(buyer);
  await buyer.getByRole("button", { name: "Devam" }).click();
  await expect(buyer.getByText("İstanbul / Kadıköy / Caferağa")).toBeVisible();
  await buyer.getByLabel(/kurallarını/).check();
  await smsOnay(buyer);
  await buyer.getByRole("button", { name: "Talebi Yayınla" }).click();
  await expect(buyer.getByRole("heading", { level: 1 })).toContainText(tag);

  const seller = await (await browser.newContext()).newPage();
  await seller.goto("/kategori");
  const toggle = seller.getByRole("button", { name: "Filtrele", exact: true });
  if (await toggle.isVisible()) await toggle.click();
  await seller.getByLabel("İl", { exact: true }).selectOption("İstanbul");
  await seller.getByLabel("İlçe", { exact: true }).selectOption("Kadıköy");
  await expect(seller.locator(".tbl-wrap").getByRole("link", { name: new RegExp(tag) })).toBeVisible();
  await seller.getByLabel("Mahalle", { exact: true }).selectOption("Caferağa");
  await expect(seller.locator(".tbl-wrap").getByRole("link", { name: new RegExp(tag) })).toBeVisible();
  await seller.getByLabel("İlçe", { exact: true }).selectOption("Üsküdar");
  await expect(seller.locator(".tbl-wrap").getByRole("link", { name: new RegExp(tag) })).toHaveCount(0);
  // Seçili filtre üstte etiket olarak görünür; × ile kaldırılınca talep geri gelir.
  const chip = seller.getByRole("button", { name: "İstanbul / Üsküdar filtresini kaldır" });
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(seller.locator(".tbl-wrap").getByRole("link", { name: new RegExp(tag) })).toBeVisible();
  await ctx.close();
});

test("acil talepler solda kategorilerin üstünde bağlantı olarak durur; ortadaki vitrin varsayılan kapalı", async ({ page }, info) => {
  const title = `Acil laptop ${rnd()}`;
  await loginSms(page, `0538${rnd().slice(0, 7)}`, "Okan Er");
  await page.goto(`/talep-ver?metin=${encodeURIComponent(`${title} acil lazım, bütçem 30 bin TL, İzmir`)}`);
  // Başlığı yapay zekâ (ya da yedek doldurucu) kendisi kurar; cümle kopyalanmaz. Test kendi benzersiz başlığını yazar.
  await expect(page.getByLabel("Talep başlığı *")).not.toHaveValue("");
  await page.getByLabel("Talep başlığı *").fill(title);
  await addPhoto(page);
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByLabel(/kurallarını/).check();
  await smsOnay(page);
  await page.getByRole("button", { name: "Talebi Yayınla" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(title);
  await page.goto("/");
  const link = info.project.name === "telefon" ? page.locator(".cat-tiles .ct-acil-tile") : page.locator(".ctree .ct-quick a");
  await expect(link).toBeVisible();
  await expect(page.getByRole("heading", { name: "Acil Alım Talepleri" })).toHaveCount(0);
  await link.click();
  await page.waitForURL(/acil=1/);
  await expect(page.locator(".tbl-wrap").getByRole("link", { name: new RegExp(title) })).toBeVisible();
});

test("talep formunda alt kategoriye göre seçenekler çıkar: arsada imar ve tapu, oda sayısı yok; yatta tekne tipi", async ({ page }) => {
  await loginSms(page, `0538${rnd().slice(0, 7)}`, "Arsa Arayan");
  await page.goto("/talep-ver");
  await page.locator(".cat-col").getByRole("button", { name: "Emlak" }).click();
  await page.locator(".cat-col").getByRole("button", { name: "Arsa" }).click();
  await page.getByRole("button", { name: "Devam" }).click();
  await expect(page.getByLabel("İmar durumu")).toBeVisible();
  await expect(page.getByLabel("Tapu durumu")).toBeVisible();
  await expect(page.getByLabel("m² (en az)")).toBeVisible();
  await expect(page.getByLabel("Oda sayısı")).toHaveCount(0);
  await expect(page.getByLabel("Eşya durumu")).toHaveCount(0);
  await page.getByRole("button", { name: "Değiştir" }).click();
  await page.locator(".cat-col").getByRole("button", { name: "Vasıta" }).click();
  await page.locator(".cat-col").getByRole("button", { name: "Deniz Araçları" }).click();
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByLabel("Tip").selectOption("Yat");
  await expect(page.getByLabel("Boy (en az, metre)")).toBeVisible();
  await expect(page.getByLabel("İmar durumu")).toHaveCount(0);
});

test("satıcı ayrıntılı alarm kurar: arsa, İzmir / Urla, imar Konut, bütçe aralığı", async ({ page }) => {
  await loginSms(page, `0539${rnd().slice(0, 7)}`, "Arsa Satıcısı");
  await page.goto("/bana-ozel?s=alarm");
  await page.getByLabel("Ana kategori *").selectOption("emlak");
  await page.getByLabel("Alt kategori").selectOption("arsa");
  await page.getByLabel(/^İller/).selectOption("İzmir");
  await page.getByLabel("İlçe", { exact: true }).selectOption("Urla");
  await page.getByLabel("Alıcı bütçesi en az (TL)").fill("1000000");
  await page.getByLabel("Alıcı bütçesi en fazla (TL)").fill("5000000");
  await page.getByRole("button", { name: "Konut", exact: true }).click();
  await page.getByLabel("Arsanızın m²'si").fill("600");
  await page.getByRole("button", { name: "Alarm kur" }).click();
  await expect(page.getByText("Alarm kuruldu.", { exact: false })).toBeVisible();
  const row = page.locator(".tbl tbody tr", { hasText: "Emlak › Arsa" });
  await expect(row.getByText("İzmir / Urla")).toBeVisible();
  await expect(row.getByText("1.000.000 – 5.000.000 TL")).toBeVisible();
  await expect(row.getByText("İmar durumu: Konut")).toBeVisible();
  await expect(row.getByText("m²: 600")).toBeVisible();
  // Talep listesinde de satıcı kendi arsasının m²'sini girip uyan talepleri görür.
  await page.goto("/kategori/emlak");
  const toggle = page.getByRole("button", { name: /^Filtrele/ });
  if (await toggle.isVisible()) await toggle.click();
  await page.getByLabel("Gayrimenkulünüzün m²'si").fill("600");
  await expect(page.getByRole("button", { name: "m²: 600 filtresini kaldır" })).toBeVisible();
  await page.goto("/bana-ozel?s=alarm");

  // Vasıta: tek alarma birden fazla araç ve il; yakıtta birden fazla seçim, "Farketmez" ile temizlenir.
  await page.getByLabel("Ana kategori *").selectOption("vasita");
  await page.getByLabel("Marka", { exact: true }).selectOption("BMW");
  await page.getByLabel("Model", { exact: true }).selectOption("1 Serisi");
  await page.getByRole("button", { name: "+ Ekle" }).click();
  await page.getByLabel("Marka", { exact: true }).selectOption("Audi");
  await page.getByRole("button", { name: "+ Ekle" }).click();
  await expect(page.getByRole("button", { name: "Audi (tüm modeller) aracını çıkar" })).toBeVisible();
  await page.getByLabel(/^İller/).selectOption("İzmir");
  await page.getByLabel(/^İller/).selectOption("Manisa");
  await expect(page.getByLabel("İlçe", { exact: true })).toBeDisabled();
  const fuel = page.getByRole("group", { name: "Yakıt" });
  await fuel.getByRole("button", { name: "Dizel" }).click();
  await fuel.getByRole("button", { name: "Hibrit" }).click();
  await expect(fuel.getByRole("button", { name: "Farketmez" })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Alarm kur" }).click();
  const vrow = page.locator(".tbl tbody tr", { hasText: "Vasıta" });
  await expect(vrow.getByText("BMW 1 Serisi, Audi (tüm modeller)")).toBeVisible();
  await expect(vrow.getByText("İzmir, Manisa")).toBeVisible();
  await expect(vrow.getByText("Yakıt: Dizel, Hibrit")).toBeVisible();

});

test("tek cümleden talep: yapay zekâ kategori, il/ilçe/mahalle, oda, m², eşya, ısıtma ve bütçeyi doldurur; kalanı söyler", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Ne almak istiyorsunuz?").fill("Caddebostan'da 3+1 eşyalı kiralık daire arıyorum, en az 120 m2, kombili olsun, aylık 40 bin TL'ye kadar");
  await page.getByRole("button", { name: "Talep Oluştur" }).click();
  await expect(page.getByText("✨ Yapay zekâ doldurdu:")).toBeVisible();
  await expect(page.locator(".ai-fill")).toContainText("Emlak › Konut (Kiralık)");
  await expect(page.locator(".ai-fill")).toContainText("İstanbul / Kadıköy / Caddebostan");
  await expect(page.getByLabel("İl *")).toHaveValue("İstanbul");
  await expect(page.getByLabel("İlçe")).toHaveValue("Kadıköy");
  await expect(page.getByLabel("Mahalle")).toHaveValue("Caddebostan");
  await expect(page.getByLabel("En fazla bütçe (TL) *")).toHaveValue("40000");
  await expect(page.getByLabel("Oda sayısı")).toHaveValue("3+1");
  await expect(page.getByLabel("m² (en az)")).toHaveValue("120");
  await expect(page.getByLabel("Eşya durumu")).toHaveValue("Eşyalı");
  await expect(page.getByLabel("Isıtma")).toHaveValue("Kombi");
});

test("telefonda giriş kutularının yazısı en az 16px (iPhone dokununca sayfayı büyütmesin)", async ({ page }, info) => {
  test.skip(info.project.name !== "telefon");
  for (const path of ["/", "/talep-ver", "/giris"]) {
    await page.goto(path);
    const small = await page.evaluate(() => [...document.querySelectorAll("input:not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea")]
      .filter((e) => (e as HTMLElement).offsetParent !== null && parseFloat(getComputedStyle(e).fontSize) < 16).map((e) => (e as HTMLElement).outerHTML.slice(0, 80)));
    expect(small, path).toEqual([]);
  }
});

test("Güvenli Al: satıcı satış başlatır, alıcı öder, satıcı kargolar, alıcı onaylar", async ({ browser }) => {
  const buyerCtx = await browser.newContext();
  const buyer = await buyerCtx.newPage();
  const title = `PS5 almak istiyorum ${rnd()}`;
  await loginSms(buyer, `0532${rnd().slice(0, 7)}`, "Elif Sönmez");
  await buyer.goto("/");
  await buyer.getByLabel("Ne almak istiyorsunuz?").fill(`${title}, bütçem 15 bin TL, Ankara`);
  await buyer.getByRole("button", { name: "Talep Oluştur" }).click();
  await expect(buyer.getByLabel("Talep başlığı *")).not.toHaveValue("");
  await buyer.getByLabel("Talep başlığı *").fill(title);
  await addPhoto(buyer);
  await buyer.getByRole("button", { name: "Devam" }).click();
  await buyer.getByLabel(/kurallarını/).check();
  await smsOnay(buyer);
  await buyer.getByRole("button", { name: "Talebi Yayınla" }).click();
  await expect(buyer.getByRole("heading", { level: 1, name: title })).toBeVisible();
  const url = buyer.url();

  const sellerCtx = await browser.newContext();
  const seller = await sellerCtx.newPage();
  await loginSms(seller, `0533${rnd().slice(0, 7)}`, "Ahmet Kaya");
  await seller.goto(url);
  await seller.getByRole("button", { name: /Numarayı Gör/ }).click();
  await seller.getByRole("button", { name: "Güvenli Al ile sat" }).click();
  await seller.getByLabel("Anlaştığınız fiyat (TL)").fill("14000");
  await expect(seller.locator(".safe-fee")).toContainText("13.300 TL");
  await seller.getByLabel("Paranızın gönderileceği IBAN").fill("TR33 0006 1005 1978 6457 8413 26");
  await seller.getByLabel("Hesap sahibinin adı").fill("Ahmet Kaya");
  await seller.getByRole("button", { name: "Satışı başlat ve alıcıya gönder" }).click();
  await seller.getByRole("link", { name: "Satışı görüntüle »" }).click();
  await expect(seller.getByText("Alıcının ödeme yapması bekleniyor")).toBeVisible();
  const saleUrl = seller.url();

  // Alıcı talep sayfasında satışı görür, adresini yazıp öder (deneme modu).
  await buyer.reload();
  await buyer.locator(".safe-mini-i").first().click();
  await expect(buyer.getByText("14.210 TL", { exact: false }).first()).toBeVisible();
  await buyer.getByLabel("Ad soyad", { exact: true }).fill("Elif Sönmez");
  await buyer.getByLabel("Telefon", { exact: true }).fill("05321112233");
  await buyer.getByLabel("İl", { exact: true }).fill("Ankara");
  await buyer.getByLabel("Açık adres").fill("Kızılay Mah. Atatürk Bulvarı No: 10 Çankaya");
  await buyer.getByRole("button", { name: /Güvenli Öde/ }).click();
  await expect(buyer.getByText("Deneme ödeme ekranı")).toBeVisible();
  await buyer.getByRole("button", { name: /öde \(deneme\)/ }).click();
  await expect(buyer.getByText("Ödemeniz alındı ve güvende", { exact: false })).toBeVisible();

  // Satıcı adresi görür, kargolar.
  await seller.goto(saleUrl);
  await expect(seller.locator(".safe-addr")).toContainText("Kızılay Mah.");
  await seller.getByLabel("Kargo takip numarası").fill("1234567890");
  await seller.getByRole("button", { name: "Kargoya verdim" }).click();
  await expect(seller.getByText("Kargo bilgisi alıcıya iletildi", { exact: false }).first()).toBeVisible();

  // Alıcı onaylar; satış tamamlanır, satıcıya ödeme bilgisi çıkar.
  await buyer.reload();
  await expect(buyer.getByText("1234567890").first()).toBeVisible();
  buyer.once("dialog", (d) => void d.accept());
  await buyer.getByRole("button", { name: "Ürünü aldım, onaylıyorum" }).click();
  await expect(buyer.getByText("Satış tamamlandı.", { exact: false }).first()).toBeVisible();
  expect(await buyer.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await seller.reload();
  await expect(seller.getByText("13.300 TL en geç 2 iş günü içinde", { exact: false })).toBeVisible();
  await seller.goto("/guvenli-al");
  await expect(seller.locator(".tbl tr", { hasText: title })).toContainText("Tamamlandı");
  await buyerCtx.close(); await sellerCtx.close();
});
