import { expect, test, type Page } from "@playwright/test";

const API = process.env.E2E_API_URL ?? "http://localhost:8080";
const rnd = () => String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
// Kod mesajı gönderilene kadar bekler (düğmeye basıldıktan hemen sonra henüz gelmemiş olabilir).
const code = async (page: Page, to: string) => {
  let found = "";
  await expect.poll(async () => {
    const msg = await (await page.request.get(`${API}/api/__test/last-message?to=${encodeURIComponent(to)}`)).json();
    found = msg?.text?.match(/\d{6}/)?.[0] ?? "";
    return found;
  }, { timeout: 10_000 }).not.toBe("");
  return found;
};

// Listeden seçim penceresi: açar, arar, seçer ve pencerenin kapanmasını bekler.
async function choose(page: Page, label: string, value: string) {
  await page.getByRole("button", { name: new RegExp(`^${label.replace(/[*+()]/g, "\\$&")}:`) }).click();
  await page.getByLabel(`${label} ara`).fill(value);
  await page.getByRole("button", { name: value, exact: true }).click();
  await expect(page.getByLabel(`${label} ara`)).toBeHidden();
}

// Yeni üye girişten sonra Üyelik Sözleşmesi onay penceresini görür; kutu açılmadan onaylanamaz.
async function acceptTerms(page: Page) {
  await expect(page.getByText("Sözleşme onayı")).toBeVisible();
  await expect(page.getByRole("button", { name: "Onayla ve devam et" })).toBeDisabled();
  await page.getByLabel("Üyelik Sözleşmesi'ni onaylıyorum").click();
  await page.getByRole("button", { name: "Onayla ve devam et" }).click();
  await expect(page.getByText("Sözleşme onayı")).toBeHidden();
}

// Uygulamadaki gibi giriş: Hesabım → Giriş yap → telefon → kod.
async function login(page: Page, phone: string, name: string) {
  await page.goto("/hesap");
  await page.getByRole("button", { name: "Giriş yap / Üye ol" }).click();
  await page.getByLabel("Cep telefonu").fill(phone);
  await page.getByRole("button", { name: "Kod gönder" }).click();
  await expect(page.getByLabel("Gelen 6 haneli kod")).toBeVisible();
  await page.getByLabel("Gelen 6 haneli kod").fill(await code(page, "90" + phone.slice(1)));
  await page.getByLabel("Adınız soyadınız (yeni üyeyseniz)").fill(name);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page.getByText(name).first()).toBeVisible();
  await acceptTerms(page);
}

test("ana sayfa: arama, kategoriler ve Son Eklenen Talepler; kategoriye dokununca talepler listelenir", async ({ page }) => {
  await page.goto("/");
  // İlk açılışta tanıtım: Devam → Devam → Başlayalım; bir daha gösterilmez.
  await expect(page.getByText("Almak istediğini yaz")).toBeVisible();
  await page.getByRole("button", { name: "Devam" }).click();
  await expect(page.getByText("Satıcılar sana ulaşsın")).toBeVisible();
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByRole("button", { name: "Başlayalım" }).click();
  await expect(page.getByText("Neyi arıyorsunuz?")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Neyi arıyorsunuz?")).toBeVisible();
  await expect(page.getByRole("button", { name: "Tanıtımı geç" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Vasıta" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Son Eklenen Talepler" })).toBeVisible();
  await page.getByRole("link", { name: "Vasıta" }).click();
  await expect(page).toHaveURL(/talepler\?top=vasita/);
  await expect(page.getByText(/\d+ talep/)).toBeVisible();
  await expect(page.locator("[aria-label]").filter({ hasText: "TL" }).first()).toBeVisible();
});

test("alıcı uygulamadan giriş yapar, tek cümleyle talep verir, fotoğraf ekler, SMS onayıyla yayınlar; satıcı numarayı görür ve mesaj atar", async ({ page, browser }) => {
  const phone = `0539${rnd().slice(0, 7)}`;
  await login(page, phone, "Uygulama Alıcı");
  await page.goto("/talep-ver");
  const title = `Uygulamadan PS5 ${rnd()}`;
  await page.getByLabel("Tek cümleyle yazın").fill("PS5 almak istiyorum, bütçem 15 bin TL, Ankara");
  await page.getByRole("button", { name: "Yapay zekâ ile doldur" }).click();
  await expect(page.getByText(/Doldurduk/)).toBeVisible();
  await expect(page.getByLabel("Fiyat (TL) *")).toHaveValue("15000");
  await expect(page.getByRole("button", { name: /İl \*: Ankara/ })).toBeVisible();
  await page.getByLabel("Talep başlığı *").fill(title);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "🖼 Galeriden seç" }).click();
  await (await chooser).setFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("button", { name: "Fotoğrafı kaldır" })).toBeVisible();
  await page.getByLabel("Kuralları onaylıyorum").click();
  await page.getByRole("button", { name: "SMS onay kodu gönder" }).click();
  await expect(page.getByLabel("SMS ile gelen 6 haneli kod")).toBeVisible();
  await page.getByLabel("SMS ile gelen 6 haneli kod").fill(await code(page, "90" + phone.slice(1)));
  await page.getByRole("button", { name: "Talebi Yayınla" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("15.000 TL").first()).toBeVisible();
  const url = page.url();

  const ctx = await browser.newContext({ baseURL: "http://localhost:8090" });
  const seller = await ctx.newPage();
  await login(seller, `0539${rnd().slice(0, 7)}`, "Uygulama Satıcı");
  await seller.goto(new URL(url).pathname);
  await seller.getByRole("button", { name: /Numarayı Gör/ }).click();
  await expect(seller.getByRole("button", { name: "Alıcıyı ara" })).toBeVisible();
  await seller.getByRole("button", { name: "Mesaj yaz" }).click();
  await seller.getByLabel("Mesajınız").fill("Merhaba, kutulu PS5 elimde.");
  await seller.getByRole("button", { name: "Gönder" }).click();
  await expect(seller.getByText("Merhaba, kutulu PS5 elimde.")).toBeVisible();
  await ctx.close();

  // Alıcı Mesajlar sekmesinde satıcının mesajını görür.
  await page.goto("/mesajlar");
  await expect(page.getByText("Merhaba, kutulu PS5 elimde.")).toBeVisible();
});

test("üye uygulamadan e-posta ve telefon bildirimi tercihlerini kaydeder ve hesabını SİL yazarak siler", async ({ page }) => {
  await login(page, `0539${rnd().slice(0, 7)}`, "Silinecek Uygulama");
  await page.goto("/hesap/bilgiler");
  const sw = page.getByRole("switch", { name: "Yeni mesaj geldiğinde", exact: true });
  await expect(sw).toBeChecked();
  await sw.click({ force: true });
  await expect(sw).not.toBeChecked();
  // Telefon bildirimleri: duyurular kapatılır; diğerleri açık kalır.
  await expect(page.getByText("Anlık bildirimler telefon uygulamasında gelir.", { exact: false })).toBeVisible();
  const news = page.getByRole("switch", { name: "Telefon bildirimi: almakisterim duyuruları ve fırsatlar" });
  await expect(news).toBeChecked();
  await news.click({ force: true });
  await expect(news).not.toBeChecked();
  const saved = page.waitForResponse((r) => r.url().endsWith("/api/me") && r.request().method() === "PATCH");
  await page.getByRole("button", { name: "Kaydet" }).click();
  const sr = await saved;
  expect(sr.ok(), await sr.text()).toBeTruthy();
  expect(sr.request().postDataJSON()).toMatchObject({ mail_prefs: { message: false }, push_prefs: { news: false, offer: true } });
  // Sayfa yeniden açılınca kayıtlı seçim gelir.
  await page.reload();
  await expect(page.getByRole("switch", { name: "Telefon bildirimi: almakisterim duyuruları ve fırsatlar" })).not.toBeChecked();
  await expect(page.getByRole("switch", { name: "Telefon bildirimi: Yeni mesaj geldiğinde" })).toBeChecked();
  await page.getByLabel("Onaylamak için büyük harflerle SİL yazın").fill("SİL");
  page.on("dialog", (d) => d.accept());
  const gone = page.waitForResponse((r) => r.url().endsWith("/api/me") && r.request().method() === "DELETE");
  await page.getByRole("button", { name: "Hesabımı kalıcı olarak sil" }).click();
  expect((await gone).ok()).toBeTruthy();
});

test("araç talebi: yapay zekâ markayı doldurur, ikinci araç seçilir; talep sayfasında araçlar ve yıl görünür", async ({ page }) => {
  const phone = `0539${rnd().slice(0, 7)}`;
  await login(page, phone, "Araç Alıcı");
  await page.goto("/talep-ver");
  await page.getByLabel("Tek cümleyle yazın").fill("2018 sonrası dizel otomatik BMW 3 serisi arıyorum, bütçem 1,5 milyon, İstanbul");
  await page.getByRole("button", { name: "Yapay zekâ ile doldur" }).click();
  await expect(page.getByText(/Doldurduk/)).toBeVisible();
  await expect(page.getByText("BMW 3 Serisi", { exact: true })).toBeVisible();
  // İkinci araç: Audi A4
  await choose(page, "Marka", "Audi");
  await choose(page, "Model", "A4");
  await page.getByRole("button", { name: "+ Bir araç daha ekle" }).click();
  await expect(page.getByText("Audi A4", { exact: true })).toBeVisible();
  await page.getByLabel("Talep başlığı *").fill(`Uygulamadan araç ${rnd()}`);
  // Her araç ayrı talep olur: her birine kendi fotoğrafı eklenir.
  for (const [i, car] of ["BMW 3 Serisi", "Audi A4"].entries()) {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: `${car} için galeriden seç` }).click();
    await (await chooser).setFiles({ name: `foto${i}.png`, mimeType: "image/png", buffer: PNG });
    await expect(page.getByRole("button", { name: "Fotoğrafı kaldır" })).toHaveCount(i + 1);
  }
  await page.getByLabel("Kuralları onaylıyorum").click();
  await page.getByRole("button", { name: "SMS onay kodu gönder" }).click();
  await expect(page.getByLabel("SMS ile gelen 6 haneli kod")).toBeVisible();
  await page.getByLabel("SMS ile gelen 6 haneli kod").fill(await code(page, "90" + phone.slice(1)));
  await page.getByRole("button", { name: "Talebi Yayınla" }).click();
  await expect(page.getByText("Model yılı", { exact: true })).toBeVisible();
  await expect(page.getByText("BMW 3 Serisi", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("2018 ve sonrası", { exact: true })).toBeVisible();
  await expect(page.getByText("1.500.000 TL").first()).toBeVisible();
});

test("satıcı talebi favoriye ekler, Hesabım → Favori Talepler'de görür; talebi şikâyet eder", async ({ page }) => {
  await login(page, `0539${rnd().slice(0, 7)}`, "Favori Satıcı");
  const r = (await (await page.request.get(`${API}/api/requests?per=1`)).json()).items[0];
  await page.goto(`/talep/${r.id}`);
  await page.getByRole("button", { name: "Favorilere ekle" }).click();
  await expect(page.getByRole("button", { name: "Favorilerden çıkar" })).toBeVisible();
  await page.getByRole("button", { name: "Talebi şikâyet et" }).click();
  await page.getByRole("radio", { name: "Sahte veya yanıltıcı talep" }).click();
  await page.getByRole("button", { name: "Gönder" }).click();
  await expect(page.getByText("Şikâyetiniz alındı. Ekibimiz inceleyecek.")).toBeVisible();
  await page.goto("/hesap/favoriler");
  await expect(page.getByRole("link", { name: r.title })).toBeVisible();
});

test("satıcı ayrıntılı alarm kurar: Vasıta, iki il, BMW, fiyat aralığı, yakıt; özet listede görünür ve silinir", async ({ page }) => {
  await login(page, `0539${rnd().slice(0, 7)}`, "Alarm Satıcı");
  await page.goto("/hesap/alarmlar");
  await choose(page, "Kategori *", "Vasıta (tümü)");
  for (const il of ["İstanbul", "Ankara"]) await choose(page, "İl ekle", il);
  await expect(page.getByRole("checkbox", { name: "Ankara ilini kaldır" })).toBeVisible();
  await page.getByLabel("En az fiyat (TL)").fill("500000");
  await page.getByLabel("En çok fiyat (TL)").fill("2000000");
  await choose(page, "Marka", "BMW");
  await page.getByRole("button", { name: "+ Aracı listeye ekle" }).click();
  await expect(page.getByText("BMW (tüm modeller)", { exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: "Dizel" }).click();
  const saved = page.waitForResponse((r) => r.url().endsWith("/api/me/alarms") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Alarm kur" }).click();
  const sr = await saved;
  expect(sr.ok(), await sr.text()).toBeTruthy();
  await expect(page.getByText(/İstanbul, Ankara · 500\.000 – 2\.000\.000 TL · BMW \(tüm modeller\) · Yakıt: Dizel/)).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Vasıta alarmını sil" }).click();
  await expect(page.getByText("Henüz alarmınız yok.")).toBeVisible();
});

test("e-postayla giren üye uygulamada telefon numarasını SMS koduyla doğrular", async ({ page }) => {
  const email = `uye${rnd()}@ornek.com`;
  await page.goto("/hesap");
  await page.getByRole("button", { name: "Giriş yap / Üye ol" }).click();
  await page.getByRole("tab", { name: "E-posta" }).click();
  await page.getByLabel("E-posta adresi").fill(email);
  await page.getByRole("button", { name: "Kod gönder" }).click();
  await page.getByLabel("Gelen 6 haneli kod").fill(await code(page, email));
  await page.getByLabel("Adınız soyadınız (yeni üyeyseniz)").fill("Telefon Ekleyen");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page.getByText("Telefon Ekleyen").first()).toBeVisible();
  await acceptTerms(page);
  await page.goto("/hesap/bilgiler");
  const phone = `0539${rnd().slice(0, 7)}`;
  await page.getByLabel("Cep telefonu").fill(phone);
  await page.getByRole("button", { name: "Doğrulama kodu gönder" }).click();
  await expect(page.getByLabel("SMS ile gelen 6 haneli kod")).toBeVisible();
  await page.getByLabel("SMS ile gelen 6 haneli kod").fill(await code(page, "90" + phone.slice(1)));
  await page.getByRole("button", { name: "Numarayı doğrula" }).click();
  await expect(page.getByText(`Telefon: ${phone}`, { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Doğrulama kodu gönder" })).toHaveCount(0);
});

test("talepler: arama yapılınca son aramalarda kalır, dokununca yeniden aranır, temizlenir", async ({ page }) => {
  await page.goto("/talepler");
  const box = page.getByLabel("Talep ara");
  await box.fill("PS5");
  await box.press("Enter");
  await expect(page.getByText(/\d+ talep/)).toBeVisible();
  await box.fill("");
  await box.focus();
  const recent = page.getByLabel("Son aramalar");
  await expect(recent.getByRole("button", { name: "PS5" })).toBeVisible();
  await recent.getByRole("button", { name: "PS5" }).click();
  await expect(box).toHaveValue("PS5");
  await box.fill("");
  await box.focus();
  await recent.getByRole("button", { name: "Temizle" }).click();
  await expect(page.getByLabel("Son aramalar")).toHaveCount(0);
});

test("emlak talebi: yapay zekâ oda sayısını doldurur, elle değişir; mahalle, acil ve 30 gün seçilir; talep sayfasında görünür", async ({ page }) => {
  const phone = `0539${rnd().slice(0, 7)}`;
  await login(page, phone, "Emlak Alıcı");
  await page.goto("/talep-ver");
  await page.getByLabel("Tek cümleyle yazın").fill("Kadıköy'de 3+1 kiralık daire arıyorum, en az 100 m², bütçem 40 bin TL, İstanbul");
  await page.getByRole("button", { name: "Yapay zekâ ile doldur" }).click();
  await expect(page.getByText(/Doldurduk/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Oda sayısı: 3+1" })).toBeVisible();
  await choose(page, "Oda sayısı", "2+1");
  await choose(page, "Isıtma", "Kombi");
  await page.getByLabel("m² (en az)").fill("90");
  await expect(page.getByRole("button", { name: /^İlçe: Kadıköy/ })).toBeVisible();
  await choose(page, "Mahalle", "Caferağa");
  await page.getByLabel("Talep başlığı *").fill(`Uygulamadan kiralık ${rnd()}`);
  // Hazır görseller penceresi açılır (test galerisinde görsel olmayabilir), kapatılıp kendi fotoğrafı eklenir.
  await page.getByRole("button", { name: "Hazır görsellerden seç" }).click();
  await expect(page.getByRole("heading", { name: "Hazır görseller" })).toBeVisible();
  await page.getByRole("button", { name: "Kapat" }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "🖼 Galeriden seç" }).click();
  await (await chooser).setFiles({ name: "ev.png", mimeType: "image/png", buffer: PNG });
  await page.getByLabel("Acil talep").click();
  await page.getByRole("radio", { name: "30 gün" }).click();
  await page.getByLabel("Kuralları onaylıyorum").click();
  await page.getByRole("button", { name: "SMS onay kodu gönder" }).click();
  await expect(page.getByLabel("SMS ile gelen 6 haneli kod")).toBeVisible();
  await page.getByLabel("SMS ile gelen 6 haneli kod").fill(await code(page, "90" + phone.slice(1)));
  const pub = page.waitForResponse((r) => r.url().endsWith("/api/requests") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Talebi Yayınla" }).click();
  const body = JSON.parse((await pub).request().postData()!);
  expect(body).toMatchObject({ is_urgent: true, days: 30, neighbourhood: "Caferağa", attrs: { oda: "2+1", isitma: "Kombi", m2: 90 } });
  await expect(page.getByText("ACİL").first()).toBeVisible();
  await expect(page.getByText("Oda sayısı", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("2+1", { exact: true }).last()).toBeVisible();
});

test("ayrıntılı seçim: telefonda model markaya göre gelir; araçta motor/paket seçilir; alarmda paket yazılır", async ({ page }) => {
  await login(page, `0539${rnd().slice(0, 7)}`, "Ayrıntı Alıcı");
  await page.goto("/talep-ver");
  await page.getByLabel("Tek cümleyle yazın").fill("iphone 12 pro max almak istiyorum, bütçem 30 bin TL, Ankara");
  await page.getByRole("button", { name: "Yapay zekâ ile doldur" }).click();
  await expect(page.getByRole("button", { name: "Model: iPhone 12 Pro Max" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Marka: Apple" })).toBeVisible();
  // Marka değişince eski model bırakılır; yeni markanın modelleri gelir.
  await choose(page, "Marka", "Samsung");
  await expect(page.getByRole("button", { name: "Model: Farketmez" })).toBeVisible();
  await choose(page, "Model", "Galaxy S24 Ultra");

  await page.goto("/talep-ver");
  await page.getByLabel("Tek cümleyle yazın").fill("bmw 320d arıyorum, bütçem 1,5 milyon, İstanbul");
  await page.getByRole("button", { name: "Yapay zekâ ile doldur" }).click();
  await expect(page.getByText("BMW 3 Serisi 320d", { exact: true })).toBeVisible();
  await choose(page, "Marka", "Audi");
  await choose(page, "Model", "A4");
  await choose(page, "Motor / paket", "2.0 TDI");
  await expect(page.getByLabel("Seçiminiz")).toHaveText("Seçiminiz: Audi › A4 › 2.0 TDI");
  await page.getByRole("button", { name: "+ Bir araç daha ekle" }).click();
  await expect(page.getByText("Audi A4 2.0 TDI", { exact: true })).toBeVisible();

  await page.goto("/hesap/alarmlar");
  await choose(page, "Kategori *", "Vasıta (tümü)");
  await choose(page, "Marka", "BMW");
  await choose(page, "Model", "3 Serisi");
  await choose(page, "Motor / paket", "320d");
  await page.getByRole("button", { name: "+ Aracı listeye ekle" }).click();
  await expect(page.getByText("BMW 3 Serisi 320d", { exact: true })).toBeVisible();
  const saved = page.waitForResponse((r) => r.url().endsWith("/api/me/alarms") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Alarm kur" }).click();
  expect((await saved).ok()).toBeTruthy();
  await expect(page.getByText(/BMW 3 Serisi 320d/).last()).toBeVisible();
});
