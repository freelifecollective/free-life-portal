import { describe, expect, it } from "vitest";
import { addDays, parseRange, presets } from "./range";

const NOW = Date.parse("2026-11-10T15:00:00Z"); // Tuesday 10 Nov, 10am Eastern

describe("date ranges", () => {
  it("adds days across month ends", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("defaults to the last 30 days, today included", () => {
    const r = parseRange(undefined, undefined, NOW);
    expect(r.from).toBe("2026-10-12");
    expect(r.to).toBe("2026-11-10");
  });
  it("includes the whole of the last day (Eastern)", () => {
    const r = parseRange("2026-11-01", "2026-11-10", NOW);
    expect(r.fromIso).toBe("2026-11-01T04:00:00.000Z"); // still daylight time on 1 Nov
    expect(r.toIso).toBe("2026-11-11T05:00:00.000Z"); // midnight after the 10th, standard time
  });
  it("swaps dates given the wrong way round and ignores junk", () => {
    expect(parseRange("2026-11-10", "2026-11-01", NOW).from).toBe("2026-11-01");
    expect(parseRange("nonsense", "2026-11-10", NOW).from).toBe("2026-10-12");
  });
  it("has shortcuts that end today", () => {
    const p = presets("2026-11-10");
    expect(p.map((x) => x.label)).toEqual(["Last 7 days", "Last 30 days", "This month", "All time"]);
    expect(p[0].from).toBe("2026-11-04");
    expect(p[2].from).toBe("2026-11-01");
  });
});
