/** Centre-crops a picture to a tall 4:5 cover (800 by 1000 pixels) and returns it as a JPEG. */
export async function coverJpeg(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const W = 800, H = 1000;
  const scale = Math.max(W / bmp.width, H / bmp.height);
  const sw = W / scale, sh = H / scale;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  c.getContext("2d")!.drawImage(bmp, (bmp.width - sw) / 2, (bmp.height - sh) / 2, sw, sh, 0, 0, W, H);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("export failed"))), "image/jpeg", 0.88));
}
