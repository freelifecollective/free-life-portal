/**
 * Turns a Vimeo or YouTube link, as people copy it from their browser, into the player address a page can show.
 * Anything else gives null. The database accepts only the two forms this returns.
 */
export function toEmbedUrl(input: string): string | null {
  let u: URL;
  try { u = new URL(input.trim()); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");
  const parts = u.pathname.split("/").filter(Boolean);

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const at = host === "player.vimeo.com" ? parts.indexOf("video") + 1 : parts.findIndex((p) => /^\d+$/.test(p));
    const id = at > 0 || (host === "vimeo.com" && at === 0) ? parts[at] : undefined;
    if (!id || !/^\d{3,15}$/.test(id)) return null;
    /* unlisted videos carry a private key, either as ?h= or as the next part of the address */
    const key = u.searchParams.get("h") ?? (host === "vimeo.com" ? parts[at + 1] : undefined);
    return `https://player.vimeo.com/video/${id}` + (key && /^[A-Za-z0-9]{1,20}$/.test(key) ? `?h=${key}` : "");
  }

  let yt: string | undefined;
  if (host === "youtu.be") yt = parts[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") yt = u.searchParams.get("v") ?? undefined;
    else if (["embed", "shorts", "live", "v"].includes(parts[0])) yt = parts[1];
  }
  if (yt && /^[A-Za-z0-9_-]{6,20}$/.test(yt)) return `https://www.youtube-nocookie.com/embed/${yt}`;
  return null;
}
