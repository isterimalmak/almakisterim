import { describe, expect, it } from "vitest";
import { branded, type Mailer, type MailOpts } from "../src/services/notify.js";
import { brandHtml, buttonText } from "../src/services/mail-html.js";

describe("sistem e-postaları marka şablonuyla gider (Marka Bahçem'deki gibi)", () => {
  it("logo, başlık, paragraflar; tek başına adres düğme, kod iri kutu, madde işaretleri liste olur; metin kaçışlıdır", () => {
    const h = brandHtml("Talebiniz yayına çıktı", "Merhaba Ayşe,\n\n\"<BMW>\" talebiniz yayında.\n\nhttps://almakisterim.com/talep/1048201\n\n• Satıcılar size ulaşacak\n• Numaranız gizli\n\nalmakisterim.com", "https://almakisterim.com");
    expect(h).toContain("almakisterim<span");
    expect(h).toContain("Talebiniz yayına çıktı</h2>");
    expect(h).toContain("&lt;BMW&gt;");
    expect(h).not.toContain("<BMW>");
    expect(h).toMatch(/href="https:\/\/almakisterim\.com\/talep\/1048201"[^>]*>Talebi görüntüle<\/a>/);
    expect(h).toContain("<li");
    const k = brandHtml("almakisterim giriş kodunuz", "almakisterim giriş kodunuz: 482913. Kod 10 dakika geçerlidir, kimseyle paylaşmayın.", "https://almakisterim.com");
    expect(k).toMatch(/letter-spacing:8px[^>]*>482913</);
    expect(k).toContain("kimseyle paylaşmayın");
  });

  it("düğme yazısı adrese göre", () => {
    expect(buttonText("https://almakisterim.com/talep-ver")).toBe("Ücretsiz talep ver");
    expect(buttonText("https://almakisterim.com/bana-ozel?s=alarm")).toBe("Talep alarmı kur");
    expect(buttonText("https://almakisterim.com/guvenli-al/5")).toBe("Satışı görüntüle");
  });

  it("html verilmemişse üretilir, verilmişse (E-posta Stüdyosu) dokunulmaz", async () => {
    const sent: { text: string; opts?: MailOpts }[] = [];
    const m: Mailer = { send: async (_to, _s, text, opts) => { sent.push({ text, opts }); } };
    const b = branded(m, "https://almakisterim.com");
    await b.send("a@b.com", "Konu", "Metin");
    await b.send("a@b.com", "Konu", "Metin", { html: "<p>stüdyo</p>", headers: { "List-Unsubscribe": "<x>" } });
    expect(sent[0]!.text).toBe("Metin");
    expect(sent[0]!.opts?.html).toContain("almakisterim");
    expect(sent[1]!.opts).toEqual({ html: "<p>stüdyo</p>", headers: { "List-Unsubscribe": "<x>" } });
  });
});
