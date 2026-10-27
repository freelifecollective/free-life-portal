/** Username rules. The database is the authority; these keep the form fast and the messages friendly. */

/** Keep in sync with `reserved_usernames` in supabase/migrations (a test checks this). */
export const RESERVED_USERNAMES = [
  "admin", "login", "api", "support", "settings", "root", "help", "portal", "community",
  "calendar", "classroom", "profile", "dashboard", "team", "calls", "documents", "search",
  "welcome", "auth", "logout", "signup", "channels", "courses", "recordings", "buddy",
  "calculator", "graphics", "messages", "notifications", "onboarding", "privacy", "terms",
] as const;

export type UsernameProblem = "too_short" | "too_long" | "bad_chars" | "reserved" | "taken";
export type UsernameCheck = { ok: true } | { ok: false; reason: UsernameProblem };

export const USERNAME_MESSAGES: Record<UsernameProblem, string> = {
  too_short: "Use at least 3 characters.",
  too_long: "Keep it to 30 characters or fewer.",
  bad_chars: "Use only lowercase letters, numbers, hyphens and underscores.",
  reserved: "That name is reserved. Try another.",
  taken: "Taken. Try adding a number or your initials.",
};

/** Lowercase letters and digits only, accents stripped. */
export function slug(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isReserved(u: string): boolean {
  return (RESERVED_USERNAMES as readonly string[]).includes(u.toLowerCase());
}

/** Format and reserved checks only. Whether a name is taken needs the database. */
export function checkUsernameFormat(raw: string): UsernameCheck {
  const u = raw.toLowerCase();
  if (u.length < 3) return { ok: false, reason: "too_short" };
  if (u.length > 30) return { ok: false, reason: "too_long" };
  if (!/^[a-z0-9_-]+$/.test(u)) return { ok: false, reason: "bad_chars" };
  if (isReserved(u)) return { ok: false, reason: "reserved" };
  return { ok: true };
}

/** First suggestion from a name: firstlast, then firstlast2, firstlast3 ... skipping unavailable ones. */
export function makeUsername(
  first: string,
  last: string,
  unavailable: (u: string) => boolean,
  random: () => number = Math.random,
): string {
  let base = (slug(first) + slug(last)).slice(0, 26);
  if (base.length < 3) base = "member" + Math.floor(1000 + random() * 9000);
  let u = base;
  let n = 2;
  while (isReserved(u) || unavailable(u)) {
    u = base + n;
    n++;
  }
  return u;
}

/** The first `count` candidates for a name, in order (firstlast, firstlast2, ...), skipping reserved names. */
export function usernameCandidates(first: string, last: string, count = 12, random: () => number = Math.random): string[] {
  let base = (slug(first) + slug(last)).slice(0, 26);
  if (base.length < 3) base = "member" + Math.floor(1000 + random() * 9000);
  const out: string[] = [];
  for (let n = 1; out.length < count; n++) {
    const u = n === 1 ? base : base + n;
    if (!isReserved(u)) out.push(u);
  }
  return out;
}
