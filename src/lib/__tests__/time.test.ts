import { describe, expect, it } from "vitest";
import { formatInZone, toZonedInput, zonedToUtc } from "../time";

describe("zonedToUtc (Eastern)", () => {
  it("winter time is UTC-5", () => {
    expect(zonedToUtc("2026-12-02T19:00")?.toISOString()).toBe("2026-12-03T00:00:00.000Z");
  });
  it("summer time is UTC-4", () => {
    expect(zonedToUtc("2026-07-07T19:00")?.toISOString()).toBe("2026-07-07T23:00:00.000Z");
  });
  it("handles the day clocks go back (Nov 1 2026): the hour after is UTC-5", () => {
    expect(zonedToUtc("2026-11-01T09:00")?.toISOString()).toBe("2026-11-01T14:00:00.000Z");
    expect(zonedToUtc("2026-10-31T09:00")?.toISOString()).toBe("2026-10-31T13:00:00.000Z");
  });
  it("picks the first of the repeated hour when clocks go back", () => {
    expect(zonedToUtc("2026-11-01T01:30")?.toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });
  it("rejects the hour that does not exist when clocks go forward (Mar 8 2026)", () => {
    expect(zonedToUtc("2026-03-08T02:30")).toBeNull();
    expect(zonedToUtc("2026-03-08T03:30")?.toISOString()).toBe("2026-03-08T07:30:00.000Z");
    expect(zonedToUtc("2026-03-08T01:30")?.toISOString()).toBe("2026-03-08T06:30:00.000Z");
  });
  it("rejects nonsense", () => {
    expect(zonedToUtc("")).toBeNull();
    expect(zonedToUtc("2026-13-01T10:00")).toBeNull();
    expect(zonedToUtc("2026-11-31T10:00")).toBeNull();
    expect(zonedToUtc("2026-11-04 19:00")).toBeNull();
    expect(zonedToUtc("2026-11-04T25:00")).toBeNull();
  });
  it("works for another zone", () => {
    expect(zonedToUtc("2026-07-01T12:00", "Australia/Sydney")?.toISOString()).toBe("2026-07-01T02:00:00.000Z");
  });
});

describe("toZonedInput", () => {
  it("round-trips through zonedToUtc", () => {
    for (const s of ["2026-01-15T07:05", "2026-07-15T19:30", "2026-11-01T00:00", "2026-12-31T23:59"]) {
      expect(toZonedInput(zonedToUtc(s)!)).toBe(s);
    }
  });
});

describe("formatInZone", () => {
  it("labels the zone", () => {
    expect(formatInZone(new Date("2026-12-03T00:00:00Z"))).toMatch(/Wed, Dec 2.*7:00 PM EST/);
    expect(formatInZone(new Date("2026-07-07T23:00:00Z"))).toMatch(/Tue, Jul 7.*7:00 PM EDT/);
  });
});
