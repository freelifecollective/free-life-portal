/** Canva share links that can be shown as a live preview inside the page (Canva's own "embed" view). */
export function canvaEmbedUrl(url: string): string | null {
  const m = /^https:\/\/(?:www\.)?canva\.com\/design\/([A-Za-z0-9_-]+)\/(?:([A-Za-z0-9_-]+)\/)?(?:view|edit|watch)(?:[/?#].*)?$/.exec(url);
  if (!m) return null;
  return `https://www.canva.com/design/${m[1]}/${m[2] ? m[2] + "/" : ""}view?embed`;
}
export const isCanvaLink = (url: string) => /^https:\/\/(?:www\.)?(?:canva\.com|canva\.link)\/\S+$/i.test(url);
