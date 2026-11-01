/** "09:30" for 570 minutes after midnight. */
export const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
export const toMin = (s: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec(s); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
/** Every half hour of the day, then midnight: the choices for an open-hours start or end. */
export const HALF_HOURS = Array.from({ length: 49 }, (_, i) => i * 30);
export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const CALL_LENGTHS = [15, 30, 45, 60] as const;
export type Hours = { weekday: number; start_min: number; end_min: number };
