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

test("alıcı talep verir, satıcı teklif verir, alıcı kabul eder", async ({ browser }) => {
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
  await seller.getByLabel("Teklif fiyatınız (TL)").fill("14250");
  await seller.getByLabel("Alıcıya mesajınız").fill("Kutulu, 2 kol. Beni 0544 111 22 33'ten arayın.");
  await seller.getByRole("button", { name: "Teklifi Gönder" }).click();
  await expect(seller.getByText("Teklifiniz:")).toBeVisible();

  await expect(seller.getByRole("link", { name: "WhatsApp'tan yaz" })).toBeVisible();

  await buyer.reload();
  await expect(buyer.locator(".phone-hidden")).toContainText("1 / 10 satıcı gördü");
  await expect(buyer.getByRole("button", { name: "Rahatsız etti" })).toBeVisible();
  await expect(buyer.locator(".badge")).toHaveText("1");
  await expect(buyer.getByText("14.250 TL").first()).toBeVisible();
  await expect(buyer.getByText("[numara gizlendi]")).toBeVisible();
  buyer.once("dialog", (d) => d.accept());
  await buyer.getByRole("button", { name: "Kabul et" }).click();
  await expect(buyer.locator(".lbl.l-soft", { hasText: "Kabul edildi" })).toBeVisible();

  await seller.reload();
  await expect(seller.getByText("Kabul edildi 🎉")).toBeVisible();
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

test("alıcı ve satıcı fotoğraf ekler, alıcı teklifteki fotoğrafı görür", async ({ browser }) => {
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
  await seller.getByRole("button", { name: /Numarayı Gör/ }).click();
  await expect(seller.locator(".phone-open")).toBeVisible();
  await seller.getByLabel("Teklif fiyatınız (TL)").fill("7500");
  await seller.getByLabel("Fotoğraf / video ekle").setInputFiles([
    { name: "urun.png", mimeType: "image/png", buffer: PNG },
    { name: "belge.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF") },
  ]);
  await expect(seller.getByAltText("Eklenen fotoğraf 1")).toBeVisible();
  await expect(seller.getByText(/"belge\.pdf" desteklenmiyor/)).toBeVisible();
  await seller.getByRole("button", { name: "Teklifi Gönder" }).click();
  await expect(seller.getByText("Teklifiniz:")).toBeVisible();

  await buyer.reload();
  await expect(buyer.getByRole("link", { name: "Teklif fotoğrafı 1" })).toBeVisible();
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
