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

test("alıcı talep verir; satıcı numarayı görür, mesaj atar; alıcı cevaplar", async ({ browser }) => {
  const buyerCtx = await browser.newContext();
  const buyer = await buyerCtx.newPage();
  const title = `PS5 almak istiyorum ${rnd()}`;

  await loginSms(buyer, `0532${rnd().slice(0, 7)}`, "Elif Sönmez");
  await buyer.goto("/");
  await buyer.getByLabel("Ne almak istiyorsunuz?").fill(`${title}, bütçem 15 bin TL, Ankara`);
  await buyer.getByRole("button", { name: "Talep Oluştur" }).click();
  await expect(buyer.getByLabel("Talep başlığı *")).toHaveValue(title);
  await expect(buyer.getByLabel("En fazla bütçe (TL) *")).toHaveValue("15000");
  await expect(buyer.getByLabel("İl *")).toHaveValue("Ankara");
  await buyer.getByRole("button", { name: "Devam" }).click();
  await buyer.getByLabel(/kurallarını/).check();
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
  await expect(buyer.locator(".tabbar .badge, .hdr .badge").first()).toBeVisible();
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
  const sw = page.getByRole("switch", { name: "Moda & Giyim" });
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "false");
  // Talep verirken bütün yayındaki kategoriler görünür; gizlenen görünmez.
  await page.goto("/talep-ver");
  await expect(page.locator(".cat-col").getByRole("button", { name: "Moda & Giyim" })).toHaveCount(0);
  await page.goto("/yonetim");
  await page.getByRole("switch", { name: "Moda & Giyim" }).click();
  await page.goto("/talep-ver");
  await expect(page.locator(".cat-col").getByRole("button", { name: "Moda & Giyim" })).toHaveCount(1);

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

  // Reklam alanı: resim yüklenir, başlık ve bağlantı verilir, ana sayfada soldaki kategorilerin altında görünür.
  const ad = `Galeri reklamı ${rnd()}`;
  await page.goto("/yonetim");
  await page.getByRole("button", { name: "Reklam Alanları" }).click();
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
  // Temizlik: test reklamı silinir.
  page.on("dialog", (d) => void d.accept());
  await page.goto("/yonetim");
  await page.getByRole("button", { name: "Reklam Alanları" }).click();
  await page.locator(".yk-satir").nth(n - 1).getByRole("button", { name: "Sil" }).click();
  await expect(page.getByText("Reklam silindi.")).toBeVisible();
});

test("yeni talep ana sayfa vitrininde kutucuk olarak görünür", async ({ page }) => {
  const title = `Vitrin bisiklet ${rnd()}`;
  await loginSms(page, `0536${rnd().slice(0, 7)}`, "Deniz Kaya");
  await page.goto(`/talep-ver?metin=${encodeURIComponent(`${title}, bütçem 9 bin TL, Ankara`)}`);
  await expect(page.getByLabel("Talep başlığı *")).toHaveValue(title);
  await page.getByLabel("Fotoğraf / video ekle").setInputFiles({ name: "v.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByAltText("Eklenen fotoğraf 1")).toBeVisible();
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByLabel(/kurallarını/).check();
  await page.getByRole("button", { name: "Talebi Yayınla" }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Ana Sayfa Vitrini" })).toBeVisible();
  const tile = page.locator(".vt").getByTitle(title);
  await expect(tile).toBeVisible();
  await tile.click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
});

test("sayfalar yana taşmıyor", async ({ page }) => {
  for (const p of ["/", "/kategori", "/kategori/vasita", "/talep-ver", "/giris", "/sayfa/kvkk"]) {
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
  await expect(buyer.getByLabel("Talep başlığı *")).toHaveValue(title);
  await buyer.getByLabel("Fotoğraf / video ekle").setInputFiles({ name: "ornek.png", mimeType: "image/png", buffer: PNG });
  await expect(buyer.getByAltText("Eklenen fotoğraf 1")).toBeVisible();
  await expect(buyer.getByText("Kapak", { exact: true })).toBeVisible();
  await buyer.getByRole("button", { name: "Devam" }).click();
  await expect(buyer.getByAltText("Talep fotoğrafı")).toBeVisible();
  await buyer.getByLabel(/kurallarını/).check();
  await buyer.getByRole("button", { name: "Talebi Yayınla" }).click();
  await expect(buyer.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(buyer.getByAltText("Talep fotoğrafı")).toBeVisible();
  const url = buyer.url();

  const sellerCtx = await browser.newContext();
  const seller = await sellerCtx.newPage();
  await loginSms(seller, `0535${rnd().slice(0, 7)}`, "Can Yıldız");
  await seller.goto(url);
  await expect(seller.getByAltText("Talep fotoğrafı")).toBeVisible();
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
  await expect(page.getByRole("button", { name: "Talep gelince haber ver" })).toBeVisible();
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
  // Üçüncü araç elle eklenir.
  await buyer.getByLabel("Marka", { exact: true }).selectOption("Mercedes-Benz");
  await buyer.getByLabel("Model", { exact: true }).selectOption("C Serisi");
  await buyer.getByRole("button", { name: "+ Ekle" }).click();
  await expect(buyer.locator(".chip.on", { hasText: "Mercedes-Benz C Serisi" })).toBeVisible();
  await buyer.getByRole("button", { name: "Devam" }).click();
  await expect(buyer.getByText("BMW 3 Serisi, Audi A4, Mercedes-Benz C Serisi")).toBeVisible();
  await buyer.getByLabel(/kurallarını/).check();
  await buyer.getByRole("button", { name: "Talebi Yayınla" }).click();
  await expect(buyer.getByRole("heading", { level: 1 })).toContainText(tag);
  await expect(buyer.getByText("BMW 3 Serisi, Audi A4, Mercedes-Benz C Serisi")).toBeVisible();

  const seller = await (await browser.newContext()).newPage();
  await seller.goto("/kategori/vasita");
  // Telefonda filtreler "Filtrele" düğmesinin arkasında.
  const toggle = seller.getByRole("button", { name: "Filtrele", exact: true });
  if (await toggle.isVisible()) await toggle.click();
  await seller.getByLabel("Aracın markası").selectOption("Audi");
  await seller.getByLabel("Aracın modeli").selectOption("A4");
  await seller.getByLabel("Aracın yılı").fill("2020");
  await expect(seller.locator(".tbl-wrap").getByRole("link", { name: new RegExp(tag) })).toBeVisible();
  // 2015 model araç "2018 sonrası" talebine uymaz; ana listede çıkmaz (alttaki "diğer talepler"de görünebilir).
  await seller.getByLabel("Aracın yılı").fill("2015");
  await expect(seller.locator(".tbl-wrap").getByRole("link", { name: new RegExp(tag) })).toHaveCount(0);
  await ctx.close();
});

test("telefon zorunlu değilken e-postayla giren alıcı telefonsuz talep verir; satıcı mesajla ulaşır", async ({ browser }) => {
  const buyerCtx = await browser.newContext();
  const buyer = await buyerCtx.newPage();
  const title = `Telefonsuz talep ${rnd()}`;
  await loginEmail(buyer, `alici${rnd()}@example.com`);
  await buyer.goto(`/talep-ver?metin=${encodeURIComponent(`${title}, bütçem 5 bin TL, Bursa`)}`);
  await expect(buyer.getByLabel("Talep başlığı *")).toHaveValue(title);
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
  await buyer.getByLabel("Mahalle").selectOption("Caferağa");
  await buyer.getByRole("button", { name: "Devam" }).click();
  await expect(buyer.getByText("İstanbul / Kadıköy / Caferağa")).toBeVisible();
  await buyer.getByLabel(/kurallarını/).check();
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
  await expect(page.getByLabel("Talep başlığı *")).toHaveValue(new RegExp(title));
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByLabel(/kurallarını/).check();
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
