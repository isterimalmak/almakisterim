import { describe, expect, it } from "vitest";
import { maskContacts, normalizeEmail, normalizePhone, publicName } from "../src/lib/util.js";
import { HeuristicAi } from "../src/services/ai.js";

describe("yardımcılar", () => {
  it("telefon numaralarını tek biçime getirir", () => {
    expect(normalizePhone("0532 111 22 33")).toBe("905321112233");
    expect(normalizePhone("+90 (532) 111-22-33")).toBe("905321112233");
    expect(normalizePhone("5321112233")).toBe("905321112233");
    expect(normalizePhone("0212 111 22 33")).toBeNull();
  });
  it("e-postayı küçük harfe çevirir ve doğrular", () => {
    expect(normalizeEmail(" Ali@Ornek.COM ")).toBe("ali@ornek.com");
    expect(normalizeEmail("ali@")).toBeNull();
  });
  it("iletişim bilgilerini gizler", () => {
    const r = maskContacts("Ara: 0532 111 22 33, yaz: a@b.com, bak: https://x.com/y");
    expect(r.masked).toBe(true);
    expect(r.text).toBe("Ara: [numara gizlendi], yaz: [e-posta gizlendi], bak: [bağlantı gizlendi]");
    expect(maskContacts("iPhone 13 128 GB, bütçe 20.000 TL").masked).toBe(false);
  });
  it("herkese açık adı kısaltır", () => {
    expect(publicName("Elif Sönmez")).toBe("Elif S.");
    expect(publicName("")).toBe("Üye");
  });
  it("kural tabanlı taslak bütçe ve ili çıkarır", async () => {
    const d = await new HeuristicAi().draftRequest("PS5 almak istiyorum, bütçem 15 bin TL, Ankara", [{ id: "oyun", name: "Oyun Konsolu", parent: "elektronik" }]);
    expect(d).toMatchObject({ category_id: "oyun", budget_max: 15000, city: "Ankara", title: "PS5 almak istiyorum" });
  });
});
