/** Makes a small JPEG preview of a file in the browser. Returns null for types we cannot preview. */
const MAX = 480;

function toJpeg(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((res) => canvas.toBlob((b) => res(b), "image/jpeg", 0.8));
}
function fit(w: number, h: number) { const k = Math.min(1, MAX / Math.max(w, h)); return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) }; }

async function imageThumb(blob: Blob): Promise<Blob | null> {
  const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
  const { w, h } = fit(bmp.width, bmp.height);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d"); if (!ctx) return null;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); ctx.drawImage(bmp, 0, 0, w, h);
  return toJpeg(c);
}

async function pdfThumb(blob: Blob): Promise<Blob | null> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const { w } = fit(base.width, base.height);
    const vp = page.getViewport({ scale: w / base.width });
    const c = document.createElement("canvas"); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext("2d"); if (!ctx) return null;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp, canvas: c }).promise;
    return toJpeg(c);
  } finally { void (doc as unknown as { destroy?: () => unknown }).destroy?.(); }
}

async function videoThumb(blob: Blob): Promise<Blob | null> {
  const url = URL.createObjectURL(blob);
  try {
    const v = document.createElement("video");
    v.muted = true; v.preload = "auto"; v.src = url;
    await new Promise<void>((res, rej) => { v.onloadeddata = () => res(); v.onerror = () => rej(new Error("video")); });
    v.currentTime = Math.min(1, (v.duration || 1) / 2);
    await new Promise<void>((res) => { v.onseeked = () => res(); });
    const { w, h } = fit(v.videoWidth, v.videoHeight);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d")?.drawImage(v, 0, 0, w, h);
    return toJpeg(c);
  } finally { URL.revokeObjectURL(url); }
}

export async function makeThumb(blob: Blob, mime: string): Promise<Blob | null> {
  try {
    if (mime.startsWith("image/") && mime !== "image/svg+xml") return await imageThumb(blob);
    if (mime === "application/pdf") return await pdfThumb(blob);
    if (mime.startsWith("video/")) return await videoThumb(blob);
  } catch { /* no preview for this one */ }
  return null;
}
