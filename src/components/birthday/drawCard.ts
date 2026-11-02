export type CardWish = { author: string; body: string };

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n/)) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const t = line ? line + " " + word : word;
      if (line && ctx.measureText(t).width > maxW) { out.push(line); line = word; } else line = t;
    }
    out.push(line);
  }
  return out;
}

/** Draws the birthday card (a heading and everyone's wishes) and saves it as a picture on the person's device. */
export async function downloadBirthdayCard(name: string, year: number, wishes: CardWish[]): Promise<void> {
  const W = 900, pad = 56, textW = W - pad * 2;
  const scratch = document.createElement("canvas").getContext("2d")!;
  scratch.font = "22px Helvetica, Arial, sans-serif";
  const blocks = wishes.map((w) => ({ lines: wrap(scratch, w.body, textW), author: w.author }));
  const bodyH = blocks.reduce((n, b) => n + b.lines.length * 30 + 34 + 28, 0);
  const H = 250 + Math.max(bodyH, 60) + 70;
  const scale = 2;
  const c = document.createElement("canvas");
  c.width = W * scale; c.height = H * scale;
  const ctx = c.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.fillStyle = "#F6F5F1"; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#AB9080"; ctx.lineWidth = 6; ctx.strokeRect(14, 14, W - 28, H - 28);
  ctx.textAlign = "center"; ctx.fillStyle = "#2B2522";
  ctx.font = "56px Georgia, 'Times New Roman', serif"; ctx.fillText("Happy Birthday!", W / 2, 120);
  ctx.font = "34px Georgia, 'Times New Roman', serif"; ctx.fillStyle = "#AB9080"; ctx.fillText(name, W / 2, 175);
  ctx.font = "18px Helvetica, Arial, sans-serif"; ctx.fillStyle = "#756A64"; ctx.fillText(`With love from your Free Life Collective family · ${year}`, W / 2, 210);
  ctx.textAlign = "left";
  let y = 262;
  for (const b of blocks) {
    ctx.font = "22px Helvetica, Arial, sans-serif"; ctx.fillStyle = "#2B2522";
    for (const l of b.lines) { ctx.fillText(l, pad, y); y += 30; }
    ctx.font = "italic 17px Helvetica, Arial, sans-serif"; ctx.fillStyle = "#AB9080";
    ctx.fillText("— " + b.author, pad, y + 4); y += 34 + 28 - 4;
  }
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
  if (!blob) throw new Error("export failed");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `birthday-card-${year}.png`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
