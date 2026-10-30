import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FAMILIES, family, newestFirst, parseKey, tagOf, tierOf } from "./defs";

describe("badges", () => {
  it("matches the levels handed out by the database", () => {
    const sql = readFileSync("supabase/migrations/0032_badges.sql", "utf8") + readFileSync("supabase/migrations/0033_milestones.sql", "utf8");
    const arrays = [...sql.matchAll(/array\[([0-9, ]+)\]/g)].map((m) => m[1].split(",").map((x) => Number(x.trim())));
    for (const f of FAMILIES) if (f.steps) expect(arrays.some((a) => a.join() === f.steps!.join()), f.id).toBe(true);
    // the open-ended ones: coaching 1 then every 10; sales 1, 5 then every 10
    expect(sql).toMatch(/generate_series\(10, coach, 10\)/);
    expect(sql).toMatch(/generate_series\(10, sales, 10\)/);
    expect(sql).toMatch(/select 1 as x union all select 5 union all/);
  });
  it("reads keys, including levels that keep going", () => {
    expect(parseKey("followup_30")?.n).toBe(30);
    expect(parseKey("followup_31")).toBeNull();
    expect(parseKey("nonsense_1")).toBeNull();
    expect(parseKey("coaching_1")?.n).toBe(1);
    expect(parseKey("coaching_70")?.n).toBe(70);
    expect(parseKey("coaching_15")).toBeNull();
    expect(parseKey("sales_5")?.n).toBe(5);
    expect(parseKey("sales_20")?.n).toBe(20);
    expect(parseKey("sales_7")).toBeNull();
    expect(parseKey("answers_100")?.n).toBe(100);
  });
  it("colours by level, topping out", () => {
    expect(tierOf(family("followup")!, 7)).toBe(0);
    expect(tierOf(family("followup")!, 365)).toBe(5);
    expect(tierOf(family("coaching")!, 1)).toBe(0);
    expect(tierOf(family("coaching")!, 10)).toBe(1);
    expect(tierOf(family("coaching")!, 50)).toBe(5);
    expect(tierOf(family("coaching")!, 200)).toBe(5);
    expect(tierOf(family("sales")!, 5)).toBe(1);
    expect(tierOf(family("sales")!, 20)).toBe(3);
  });
  it("words the levels", () => {
    expect(family("followup")!.label(90)).toBe("3 months in a row");
    expect(family("community")!.label(1)).toBe("First community call");
    expect(family("answers")!.label(1000)).toBe("Responded to 1,000 questions");
    expect(family("sales")!.label(30)).toBe("30 sales");
  });
  it("sorts tasks into streaks by their words", () => {
    expect(tagOf("Follow up with 3 leads")).toBe("followup");
    expect(tagOf("Followed-up with Sara")).toBe("followup");
    expect(tagOf("Morning outreach")).toBe("morning");
    expect(tagOf("Book the dentist")).toBeNull();
  });
  it("puts the newest first", () => {
    expect(newestFirst([{ key: "a_1", at: "2026-01-01" }, { key: "b_1", at: "2026-03-01" }])).toEqual(["b_1", "a_1"]);
  });
});
