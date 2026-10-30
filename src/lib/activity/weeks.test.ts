import { describe, expect, it } from "vitest";
import { groupByWeek, monthOf, monthOptions, monthRange, weekStart } from "./weeks";

describe("activity weeks and months", () => {
  it("finds the Monday of a week", () => {
    expect(weekStart("2026-11-04")).toBe("2026-11-02"); // Wednesday
    expect(weekStart("2026-11-02")).toBe("2026-11-02"); // Monday
    expect(weekStart("2026-11-08")).toBe("2026-11-02"); // Sunday
    expect(weekStart("2026-11-01")).toBe("2026-10-26"); // Sunday, the week before
  });
  it("groups newest week first", () => {
    const rows = [{ created_at: "2026-11-10T15:00:00Z" }, { created_at: "2026-11-04T15:00:00Z" }, { created_at: "2026-11-03T15:00:00Z" }];
    const g = groupByWeek(rows);
    expect(g.map((x) => x.start)).toEqual(["2026-11-09", "2026-11-02"]);
    expect(g[1].rows).toHaveLength(2);
    expect(g[0].label).toBe("Week of Mon, Nov 9");
  });
  it("reads months", () => {
    const r = monthRange("2026-11")!;
    expect(r.from.toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-12-01T05:00:00.000Z");
    expect(monthRange("2026-13")).toBeNull();
    expect(monthRange("nope")).toBeNull();
    expect(monthOf(Date.parse("2026-12-01T03:00:00Z"))).toBe("2026-11"); // still November in Eastern
  });
  it("lists every month from the first activity to now, newest first", () => {
    const o = monthOptions(Date.parse("2026-09-15T12:00:00Z"), Date.parse("2026-11-10T12:00:00Z"));
    expect(o.map((x) => x.value)).toEqual(["2026-11", "2026-10", "2026-09"]);
    expect(o[0].label).toBe("November 2026");
  });
});
