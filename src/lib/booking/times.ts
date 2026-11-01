/** "09:30" for 570 minutes after midnight. */
export const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
export const toMin = (s: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec(s); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
/** Every half hour of the day, then midnight: the choices for an open-hours start or end. */
export const HALF_HOURS = Array.from({ length: 49 }, (_, i) => i * 30);
export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const CALL_LENGTHS = [20, 25, 30, 35, 40, 45, 50, 55, 60] as const;
export type Hours = { weekday: number; start_min: number; end_min: number };

/** Choices for the booking rules. Hours are what is stored for notice. */
export const INTERVALS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 90, 120] as const;
export const NOTICE_HOURS = [0, 1, 2, 4, 8, 12, 24, 48, 72, 168] as const;
export const DAYS_AHEAD = [7, 14, 21, 30, 45, 60] as const;
export const BUFFERS = [0, 5, 10, 15, 20, 30, 45, 60] as const;
export const PER_DAY = [1, 2, 3, 4, 5, 6, 8, 10, 15, 20] as const;
export type Rules = { call_minutes: number; interval_minutes: number | null; min_notice_hours: number; max_days_ahead: number; buffer_before: number; buffer_after: number; max_per_day: number | null };
export const DEFAULT_RULES: Rules = { call_minutes: 30, interval_minutes: null, min_notice_hours: 2, max_days_ahead: 14, buffer_before: 0, buffer_after: 0, max_per_day: null };
