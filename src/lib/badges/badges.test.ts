import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FAMILIES, nextStep, parseKey, tagOf, tierOf } from "./defs";

describe("badges", () => {
  it("matches the levels handed out by the database", () => {
    const sql = readFileSync("supabase/migrations/0032_badges.sql", "utf8");
    const arrays = [...sql.matchAll(/array\[([0-9, ]+)\]/g)].map((m) => m[1].split(",").map((x) => Number(x.trim())));
    const find = (steps: number[]) => arrays.some((a) => a.join() === steps.join());
    for (const f of FAMILIES) expect(find(f.steps), f.id).toBe(true);
  });
  it("reads keys and tiers", () => {
    expect(parseKey("followup_30")?.n).toBe(30);
    expect(parseKey("followup_31")).toBeNull();
    expect(parseKey("nonsense_1")).toBeNull();
    const f = FAMILIES[0];
    expect(tierOf(f, 7)).toBe(0);
    expect(tierOf(f, 365)).toBe(5);
    expect(nextStep(f, 8)).toBe(14);
    expect(nextStep(f, 365)).toBeNull();
  });
  it("words the levels", () => {
    expect(FAMILIES[0].label(90)).toBe("3 months in a row");
    expect(FAMILIES[3].label(1)).toBe("Your first community call");
  });
  it("sorts tasks into streaks by their words", () => {
    expect(tagOf("Follow up with 3 leads")).toBe("followup");
    expect(tagOf("Followed-up with Sara")).toBe("followup");
    expect(tagOf("Morning outreach")).toBe("morning");
    expect(tagOf("My routine")).toBe("morning");
    expect(tagOf("Book the dentist")).toBeNull();
  });
});
