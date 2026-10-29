/** Reads a Vimeo address like vimeo.com/123456789, vimeo.com/123456789/abcdef1234 (private link) or player.vimeo.com/video/123456789?h=abcdef1234. */
export function parseVimeo(input: string): { id: string; hash: string | null } | null {
  let u: URL;
  try { u = new URL(input.trim()); } catch { return null; }
  if (!/(^|\.)vimeo\.com$/i.test(u.hostname)) return null;
  const parts = u.pathname.split("/").filter(Boolean);
  const idAt = parts.findIndex((p) => /^\d{5,14}$/.test(p));
  if (idAt === -1) return null;
  const hashPart = parts[idAt + 1];
  const hash = u.searchParams.get("h") ?? (hashPart && /^[a-z0-9]{6,32}$/i.test(hashPart) ? hashPart : null);
  return { id: parts[idAt], hash: hash ? hash.toLowerCase() : null };
}

/** "1:05:30", "12:30" or "90" to seconds; empty means none. */
export function parseTime(text: string): number | null | undefined {
  const t = text.trim();
  if (!t) return null;
  const bits = t.split(":").map((x) => Number(x));
  if (bits.length > 3 || bits.some((n) => !Number.isFinite(n) || n < 0)) return undefined;
  return bits.reduce((acc, n) => acc * 60 + n, 0);
}

export function formatTime(secs: number | null | undefined): string {
  if (secs === null || secs === undefined) return "";
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = Math.floor(secs % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
