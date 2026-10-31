/** Centre-crops a picture to a square, shrinks it to `size` pixels and returns it as a JPEG. */
export async function squareJpeg(file: File, size = 400): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  c.getContext("2d")!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("export failed"))), "image/jpeg", 0.9));
}
