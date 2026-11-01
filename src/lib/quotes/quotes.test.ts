import { describe, expect, it } from "vitest";
import { QUOTES } from "./data";
import { dayNumber, quoteFor } from "./index";

describe("daily quotes", () => {
  it("has plenty of each style, with no repeats inside a style", () => {
    for (const [style, list] of Object.entries(QUOTES)) {
      expect(list.length, style).toBeGreaterThanOrEqual(60);
      expect(new Set(list.map((q) => q.text)).size, style).toBe(list.length);
    }
  });
  it("gives a different quote on consecutive days and the same one on the same day", () => {
    expect(quoteFor("general", "2026-11-10")).toEqual(quoteFor("general", "2026-11-10"));
    expect(quoteFor("faith", "2026-11-10").text).not.toBe(quoteFor("faith", "2026-11-11").text);
  });
  it("counts days from 2024-01-01", () => {
    expect(dayNumber("2024-01-01")).toBe(0);
    expect(dayNumber("2024-03-01")).toBe(60);
  });
  it("mixes angel numbers in with the energetic messages", () => {
    const s = QUOTES.spiritual.map((q) => !!q.num);
    expect(s.some((t) => t)).toBe(true);
    expect(s.some((t) => !t)).toBe(true);
    expect(s[0]).toBe(false);
    expect(s[1]).toBe(true);
  });
  it("gives every Bible quote a reference", () => {
    expect(QUOTES.faith.every((q) => q.by && /\d/.test(q.by))).toBe(true);
  });
});
