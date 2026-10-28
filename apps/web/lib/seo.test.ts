import { describe, expect, it } from "vitest";
import { slugify, snippet, talepId, talepPath } from "./seo";

describe("arama motoru adresleri", () => {
  it("Türkçe harfler sadeleşir, işaretler tireye döner", () => {
    expect(slugify("2018 Sonrası Dizel BMW 3 Serisi Alınır, İstanbul")).toBe("2018-sonrasi-dizel-bmw-3-serisi-alinir-istanbul");
    expect(slugify("Çiğ Köfte & Şalgam ÜRÜNÜ arıyorum!")).toBe("cig-kofte-salgam-urunu-ariyorum");
    expect(slugify("   ")).toBe("");
    expect(slugify("çok uzun ".repeat(20)).length).toBeLessThanOrEqual(70);
    expect(slugify("çok uzun ".repeat(20))).not.toMatch(/-$/);
  });
  it("talep adresi numara ve okunur addan oluşur; numara adresten geri okunur", () => {
    expect(talepPath({ id: 1048231, title: "iPhone 15 Pro aranıyor", city: "İzmir" })).toBe("/talep/1048231-iphone-15-pro-araniyor-izmir");
    expect(talepPath({ id: 7, title: "", city: null })).toBe("/talep/7");
    expect(talepId("1048231-iphone-15-pro-araniyor-izmir")).toBe(1048231);
    expect(talepId("1048231")).toBe(1048231);
    expect(talepId("abc")).toBeNull();
  });
  it("açıklama kelime sınırında kısalır", () => {
    expect(snippet("kısa  metin\nikinci satır")).toBe("kısa metin ikinci satır");
    const s = snippet("kelime ".repeat(60));
    expect(s.length).toBeLessThanOrEqual(156);
    expect(s.endsWith("…")).toBe(true);
  });
});
