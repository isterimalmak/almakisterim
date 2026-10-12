import { describe, expect, it } from "vitest";
import { ago, budgetTxt, fmt, initials, leftParts, leftTxt } from "./format";

describe("biçimlendirme", () => {
  const now = new Date("2026-10-12T12:00:00Z").getTime();
  it("Türkçe sayı ve bütçe biçimi", () => {
    expect(fmt(1400000)).toBe("1.400.000");
    expect(budgetTxt(17000, 20000)).toBe("17.000 – 20.000 TL");
    expect(budgetTxt(20000, 20000)).toBe("20.000 TL");
  });
  it("geçen ve kalan süre", () => {
    expect(ago("2026-10-12T11:30:00Z", now)).toBe("30 dk önce");
    expect(ago("2026-10-12T07:00:00Z", now)).toBe("5 saat önce");
    expect(ago("2026-10-09T12:00:00Z", now)).toBe("3 gün önce");
    expect(leftTxt("2026-10-26T12:00:00Z", now)).toBe("14 gün");
    expect(leftTxt("2026-10-12T10:00:00Z", now)).toBe("Süresi doldu");
    expect(leftParts("2026-10-13T14:30:00Z", now)).toEqual({ d: 1, h: 2, m: 30 });
  });
  it("baş harfler", () => {
    expect(initials("Elif Sönmez")).toBe("ES");
    expect(initials("")).toBe("Ü");
  });
});
