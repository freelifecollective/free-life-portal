import type { Layout, TextEl } from "./layout";

export type GraphicData = { name: string; link: string; text: string; photoUrl: string | null; show: { photo: boolean; name: boolean; link: boolean } };

const FONT = "Helvetica, Arial, sans-serif";
const cache = new Map<string, Promise<HTMLImageElement | null>>();
/** Loads a picture so it can be drawn on a canvas (and saved from it). Returns null when it cannot be loaded. */
export function loadImage(src: string): Promise<HTMLImageElement | null> {
  let p = cache.get(src);
  if (!p) {
    p = new Promise((res) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
    cache.set(src, p);
  }
  return p;
}

function fit(ctx: CanvasRenderingContext2D, s: string, maxW: number): string[] {
  const words = s.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (ctx.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawText(ctx: CanvasRenderingContext2D, s: string, el: TextEl, W: number, H: number) {
  if (!s.trim()) return;
  const px = (el.size / 100) * W;
  ctx.font = `${el.bold ? "700" : "400"} ${px}px ${FONT}`;
  ctx.fillStyle = el.color;
  ctx.textBaseline = "middle";
  ctx.textAlign = el.align;
  ctx.shadowColor = "rgba(0,0,0,.25)"; ctx.shadowBlur = px * 0.15;
  const maxW = W * 0.9;
  const lines = fit(ctx, s, maxW);
  const x = (el.x / 100) * W, y0 = (el.y / 100) * H - ((lines.length - 1) * px * 1.2) / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, y0 + i * px * 1.2, maxW));
  ctx.shadowBlur = 0;
}

/** Paints the template with the person's photo, name, link and any custom text on it. */
export async function renderGraphic(canvas: HTMLCanvasElement, bgUrl: string, layout: Layout, data: GraphicData): Promise<void> {
  const bg = await loadImage(bgUrl);
  if (!bg) return;
  const W = bg.naturalWidth, H = bg.naturalHeight;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bg, 0, 0, W, H);
  if (layout.photo.on && data.show.photo && data.photoUrl) {
    const pic = await loadImage(data.photoUrl);
    if (pic) {
      const d = (layout.photo.size / 100) * W, cx = (layout.photo.x / 100) * W, cy = (layout.photo.y / 100) * H;
      ctx.save();
      ctx.beginPath();
      if (layout.photo.shape === "circle") ctx.arc(cx, cy, d / 2, 0, Math.PI * 2); else ctx.rect(cx - d / 2, cy - d / 2, d, d);
      ctx.clip();
      const side = Math.min(pic.naturalWidth, pic.naturalHeight);
      ctx.drawImage(pic, (pic.naturalWidth - side) / 2, (pic.naturalHeight - side) / 2, side, side, cx - d / 2, cy - d / 2, d, d);
      ctx.restore();
      ctx.lineWidth = Math.max(2, W * 0.004); ctx.strokeStyle = "rgba(255,255,255,.9)";
      ctx.beginPath();
      if (layout.photo.shape === "circle") ctx.arc(cx, cy, d / 2, 0, Math.PI * 2); else ctx.rect(cx - d / 2, cy - d / 2, d, d);
      ctx.stroke();
    }
  }
  if (layout.name.on && data.show.name) drawText(ctx, data.name, layout.name, W, H);
  if (layout.text.on) drawText(ctx, data.text, layout.text, W, H);
  if (layout.link.on && data.show.link) drawText(ctx, data.link, layout.link, W, H);
}
