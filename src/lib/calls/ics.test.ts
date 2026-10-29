import { describe, expect, it } from "vitest";
import { buildIcs } from "./ics";
import type { Call } from "./types";

const call: Call = { id: "abc", title: "Weekly, Call; live", description: "Line one\nLine two", kind: "community", audience: "leads_open", starts_at: "2026-11-04T00:00:00.000Z", duration_minutes: 60, pinned: false, join_url: null, host: null };

describe("buildIcs", () => {
  const ics = buildIcs([call], "https://x.test/calls", new Date("2026-10-29T12:00:00Z"));
  it("makes a calendar with one event and three reminders", () => {
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(3);
    expect(ics).toContain("DTSTART:20261104T000000Z");
    expect(ics).toContain("DTEND:20261104T010000Z");
  });
  it("escapes commas and semicolons", () => {
    expect(ics).toContain("SUMMARY:Weekly\\, Call\; live");
  });
  it("keeps lines short", () => {
    expect(ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
  });
});
