import type { Call } from "./types";
import { endsAt } from "@/lib/time";

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Calendar apps want lines of at most 75 bytes, continued with a leading space. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = " " + rest.slice(74); }
  out.push(rest);
  return out.join("\r\n");
}

const REMINDERS: [string, string][] = [["-P1D", "Tomorrow"], ["-PT1H", "In 1 hour"], ["-PT10M", "In 10 minutes"]];

/** The calls as an .ics calendar with reminders a day, an hour and ten minutes ahead. */
export function buildIcs(calls: Call[], portalUrl: string, now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Free Life Collective//Calls//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:Free Life Collective Calls", "X-PUBLISHED-TTL:PT1H", "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];
  for (const c of calls) {
    const start = new Date(c.starts_at);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${c.id}@freelife-portal`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(endsAt(start, c.duration_minutes))}`,
      `SUMMARY:${esc(c.title)}`,
      `DESCRIPTION:${esc((c.description ? c.description + "\n\n" : "") + "Join from the portal: " + portalUrl)}`,
      `URL:${portalUrl}`,
    );
    for (const [trigger, text] of REMINDERS) {
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(`${text}: ${c.title}`)}`, `TRIGGER:${trigger}`, "END:VALARM");
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
