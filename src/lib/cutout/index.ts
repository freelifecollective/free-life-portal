import { CUTOUT_MODEL_URL } from "@/lib/env";
import { refine, segment } from "./grabcut";

export type CutoutResult = {
  /** 512px canvas whose alpha channel is the person mask (this is what the touch-up brush edits) */
  alpha: HTMLCanvasElement;
  /** which engine produced it */
  engine: "model" | "fallback";
};

const SIZE = 512;
const MIN_FRACTION = 0.08;
const MAX_FRACTION = 0.97;

export function cloneCanvas(c: HTMLCanvasElement): HTMLCanvasElement {
  const n = document.createElement("canvas");
  n.width = c.width;
  n.height = c.height;
  n.getContext("2d")!.drawImage(c, 0, 0);
  return n;
}

/** Share of pixels that are mostly opaque. Used to reject masks that are clearly wrong. */
export function foregroundFraction(alpha: HTMLCanvasElement): number {
  const d = alpha.getContext("2d")!.getImageData(0, 0, alpha.width, alpha.height).data;
  let fg = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 127) fg++;
  return fg / (d.length / 4);
}

/** The person drawn from `src` through `alpha`, at 1024px. */
export function composePerson(src: HTMLCanvasElement, alpha: HTMLCanvasElement): HTMLCanvasElement {
  const pc = document.createElement("canvas");
  pc.width = pc.height = 1024;
  const px = pc.getContext("2d")!;
  px.imageSmoothingQuality = "high";
  px.drawImage(src, 0, 0, 1024, 1024);
  px.globalCompositeOperation = "destination-in";
  px.drawImage(alpha, 0, 0, 1024, 1024);
  return pc;
}

/** Built-in approximation. No download, runs everywhere, weaker on busy backgrounds. */
export function fallbackMask(src: HTMLCanvasElement): HTMLCanvasElement {
  const big = document.createElement("canvas");
  big.width = big.height = SIZE;
  const bx = big.getContext("2d", { willReadFrequently: true })!;
  bx.imageSmoothingQuality = "high";
  bx.drawImage(src, 0, 0, SIZE, SIZE);
  const sm = document.createElement("canvas");
  sm.width = sm.height = 128;
  const sx = sm.getContext("2d", { willReadFrequently: true })!;
  sx.imageSmoothingQuality = "high";
  sx.drawImage(big, 0, 0, 128, 128);
  const m = segment(sx.getImageData(0, 0, 128, 128).data, 128, 128);
  const a = refine(m, 128, 128, bx.getImageData(0, 0, SIZE, SIZE).data, SIZE, SIZE);
  const ac = document.createElement("canvas");
  ac.width = ac.height = SIZE;
  const ax = ac.getContext("2d")!;
  const id = ax.createImageData(SIZE, SIZE);
  for (let i = 0; i < a.length; i++) id.data[i * 4 + 3] = Math.round(a[i] * 255);
  ax.putImageData(id, 0, 0);
  return ac;
}

/** Segmentation model (runs in the browser; weights download on first use and are cached). */
async function modelMask(src: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  const { removeBackground } = await import("@imgly/background-removal");
  const blob: Blob = await new Promise((res, rej) => src.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/png"));
  const out = await removeBackground(blob, {
    model: "isnet_quint8",
    output: { format: "image/png" },
    ...(CUTOUT_MODEL_URL ? { publicPath: CUTOUT_MODEL_URL } : {}),
  });
  const bmp = await createImageBitmap(out);
  const ac = document.createElement("canvas");
  ac.width = ac.height = SIZE;
  ac.getContext("2d")!.drawImage(bmp, 0, 0, SIZE, SIZE);
  return ac;
}

/**
 * Cut the person out of a square photo. Tries the model first, then the built-in fallback.
 * Returns null when neither produces a believable mask (the caller then keeps the original background).
 */
export async function cutOutPerson(
  src: HTMLCanvasElement,
  opts: { engine?: "model" | "fallback" | "auto"; onEngine?: (e: "model" | "fallback") => void } = {},
): Promise<CutoutResult | null> {
  const want = opts.engine ?? "auto";
  const ok = (c: HTMLCanvasElement) => {
    const f = foregroundFraction(c);
    return f >= MIN_FRACTION && f <= MAX_FRACTION;
  };
  if (want !== "fallback") {
    try {
      const m = await modelMask(src);
      if (ok(m)) { console.info("[cutout] background removal model used"); opts.onEngine?.("model"); return { alpha: m, engine: "model" }; }
    } catch (err) {
      console.warn("Background removal model unavailable, using the built-in approximation.", err);
    }
  }
  if (want !== "model") {
    try {
      const m = fallbackMask(src);
      if (ok(m)) { console.info("[cutout] built-in approximation used"); opts.onEngine?.("fallback"); return { alpha: m, engine: "fallback" }; }
    } catch (err) {
      console.warn("Built-in cutout failed.", err);
    }
  }
  return null;
}
