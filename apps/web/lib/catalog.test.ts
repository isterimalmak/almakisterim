import { describe, expect, it } from "vitest";
import { attrLine, isAny } from "./catalog";

describe("talep özeti", () => {
  it("\"Farketmez\" seçilen durum ve özellikler yazılmaz; yalnız kesin bilgiler görünür", () => {
    expect(isAny("Farketmez")).toBe(true);
    expect(isAny("")).toBe(true);
    expect(isAny("Sıfır")).toBe(false);
    expect(attrLine("emlak", "Farketmez", { oda: "3+1", m2: 120, isitma: "Farketmez" }, "satilik")).not.toMatch(/farketmez/i);
    expect(attrLine("emlak", "Farketmez", { oda: "3+1", m2: 120 }, "satilik")).toContain("3+1");
    expect(attrLine("vasita", "Farketmez", { araclar: [] }, "otomobil")).toBe("");
    expect(attrLine("vasita", "İkinci El", { araclar: [{ marka: "BMW", model: null }], yil_min: 2018 }, "otomobil")).toMatch(/^İkinci El · BMW/);
  });
});
