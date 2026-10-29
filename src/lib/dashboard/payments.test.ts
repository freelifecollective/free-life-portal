import { describe, expect, it } from "vitest";
import { addMonths, upcomingPayments } from "./payments";

describe("upcoming payments", () => {
  it("keeps the day of the month, using the last day of short months", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-11-15", 2)).toBe("2027-01-15");
  });
  it("lists the next three, none in the past", () => {
    const last = { paid_on: "2026-09-15", amount_cents: 9700, currency: "usd", description: "Monthly membership" };
    expect(upcomingPayments(last, "2026-11-10").map((p) => p.date)).toEqual(["2026-11-15", "2026-12-15", "2027-01-15"]);
    expect(upcomingPayments(last, "2026-11-16")[0].date).toBe("2026-12-15");
  });
  it("shows nothing before a first payment", () => {
    expect(upcomingPayments(null, "2026-11-10")).toEqual([]);
  });
});
