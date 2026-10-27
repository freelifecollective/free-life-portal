/** Instagram and Facebook handle cleanup and checks. Accepts a pasted profile link or an @handle. */

export const IG_RE = /^[A-Za-z0-9._]{1,30}$/;
export const FB_RE = /^[A-Za-z0-9.]{5,50}$/;

export type Network = "instagram" | "facebook";
const HOST: Record<Network, string> = { instagram: "instagram\\.com", facebook: "facebook\\.com" };

export function cleanHandle(value: string, network: Network): string {
  let v = value.trim().replace(/^https?:\/\/(www\.|m\.)?/i, "");
  v = v.replace(new RegExp("^" + HOST[network] + "\\/", "i"), "");
  v = v.replace(/[/?#].*$/, "").replace(/^@/, "");
  return v;
}

export type HandleState = "empty" | "ok" | "bad";

export function handleState(value: string, network: Network): HandleState {
  if (!value.trim()) return "empty";
  const c = cleanHandle(value, network);
  return (network === "instagram" ? IG_RE : FB_RE).test(c) ? "ok" : "bad";
}

export const HANDLE_MESSAGES: Record<Network, string> = {
  instagram: "Instagram handles use letters, numbers, periods and underscores (up to 30).",
  facebook: "Facebook handles use letters, numbers and periods (at least 5 characters).",
};
