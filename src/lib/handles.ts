/** Instagram and Facebook handle cleanup and checks. Accepts a pasted profile link or an @handle. */

export const IG_RE = /^[A-Za-z0-9._]{1,30}$/;
export const FB_RE = /^[A-Za-z0-9.]{5,50}$/;
/** A full Facebook link, kept as typed when a simple handle will not do (business pages with numbers, profile.php?id=…). */
export const FB_LINK_RE = /^https:\/\/www\.facebook\.com\/(profile\.php\?id=[0-9]{1,30}|[A-Za-z0-9._~%/-]{1,200})$/;

export type Network = "instagram" | "facebook";
const HOST: Record<Network, string> = { instagram: "instagram\\.com", facebook: "facebook\\.com" };

/** A pasted Facebook link, tidied to https://www.facebook.com/… (tracking bits removed), or null if it is not one. */
function facebookLink(value: string): string | null {
  const s = value.trim();
  if (!/^(https?:\/\/)?((www|m|web|mbasic)\.)?(facebook\.com|fb\.com)\//i.test(s)) return null;
  let u: URL;
  try { u = new URL(/^https?:/i.test(s) ? s : "https://" + s); } catch { return null; }
  const path = u.pathname.replace(/\/+$/, "");
  if (path === "/profile.php") { const id = u.searchParams.get("id"); return id && /^[0-9]{1,30}$/.test(id) ? `https://www.facebook.com/profile.php?id=${id}` : null; }
  return path.length > 1 ? "https://www.facebook.com" + path : null;
}

export function cleanHandle(value: string, network: Network): string {
  if (network === "facebook") {
    const link = facebookLink(value);
    if (link) {
      const rest = link.slice("https://www.facebook.com/".length);
      return FB_RE.test(rest) ? rest : link;
    }
  }
  let v = value.trim().replace(/^https?:\/\/(www\.|m\.)?/i, "");
  v = v.replace(new RegExp("^" + HOST[network] + "\\/", "i"), "");
  v = v.replace(/[/?#].*$/, "").replace(/^@/, "");
  return v;
}

export type HandleState = "empty" | "ok" | "bad";

export function handleState(value: string, network: Network): HandleState {
  if (!value.trim()) return "empty";
  if (network === "facebook" && /[/:]/.test(value) && !facebookLink(value)) return "bad";
  const c = cleanHandle(value, network);
  return (network === "instagram" ? IG_RE.test(c) : FB_RE.test(c) || FB_LINK_RE.test(c)) ? "ok" : "bad";
}

export const HANDLE_MESSAGES: Record<Network, string> = {
  instagram: "Instagram handles use letters, numbers, periods and underscores (up to 30).",
  facebook: "Use a Facebook handle (letters, numbers and periods, at least 5 characters), or paste the full link to your profile or page.",
};
