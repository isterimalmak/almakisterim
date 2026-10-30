import { describe, expect, it } from "vitest";
import { isWide } from "./ad-layout";

describe("reklam ızgarası", () => {
  it("tek sayıda yalnız son reklam tam genişlikte, çift sayıda hiçbiri", () => {
    expect([0, 1, 2].map((i) => isWide(i, 3))).toEqual([false, false, true]);
    expect([0, 1].map((i) => isWide(i, 2))).toEqual([false, false]);
    expect(isWide(0, 1)).toBe(true);
  });
});
