/**
 * Makes a picture small enough to upload (the picture storage takes up to 3 MB): at most `max` pixels on its longest side.
 * Small PNGs (often logos with see-through backgrounds) stay PNG; everything else becomes a JPEG.
 */
export async function shrinkImage(file: File, max = 2000): Promise<{ blob: Blob; ext: "jpg" | "png"; type: "image/jpeg" | "image/png" }> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  const asBlob = (type: string, q?: number) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("export failed"))), type, q));
  if (file.type === "image/png") {
    const png = await asBlob("image/png");
    if (png.size < 2_500_000) return { blob: png, ext: "png", type: "image/png" };
  }
  return { blob: await asBlob("image/jpeg", 0.86), ext: "jpg", type: "image/jpeg" };
}
