import { describe, expect, it } from "vitest";
import { ENTRIES } from "../entries";

const slots = (s: string) => (s.match(/\{\d+\}/g) ?? []).sort().join(",");

describe("translation entries", () => {
  it("have all five languages filled in", () => {
    const bad = ENTRIES.filter((e) => e.length !== 5 || e.some((t) => !t.trim()));
    expect(bad.map((e) => e[0])).toEqual([]);
  });
  it("keep the same {0} placeholders in every language", () => {
    const bad = ENTRIES.filter((e) => e.some((t) => slots(t) !== slots(e[0])));
    expect(bad.map((e) => e[0])).toEqual([]);
  });
});
