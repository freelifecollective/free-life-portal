import { describe, expect, it } from "vitest";
import { callLength, lengthById, lengthIdOf, LENGTHS } from "./length";

describe("call length", () => {
  it("offers the five choices", () => {
    expect(LENGTHS.map((l) => l.label)).toEqual(["1 hour", "1-1.5 hours", "1-2 hours", "1.5-2 hours", "2+ hours"]);
    expect(lengthById("2+")?.minutes).toBe(180);
    expect(lengthById("nope")).toBeUndefined();
  });
  it("tells the two 2-hour choices apart by their saved label", () => {
    expect(lengthIdOf({ length_label: "1.5-2 hours", duration_minutes: 120 })).toBe("1.5-2");
    expect(lengthIdOf({ length_label: "1-2 hours", duration_minutes: 120 })).toBe("1-2");
  });
  it("falls back to the minutes for older calls", () => {
    expect(lengthIdOf({ length_label: null, duration_minutes: 60 })).toBe("1h");
    expect(lengthIdOf({ duration_minutes: 75 })).toBeNull();
  });
  it("words the length for people", () => {
    expect(callLength({ length_label: "1-1.5 hours", duration_minutes: 90 })).toBe("1-1.5 hours");
    expect(callLength({ length_label: null, duration_minutes: 60 })).toBe("60 min");
  });
});
