/** Turns the quote card on the page into a picture (PNG), by reading where everything sits on the page and drawing the same thing at 1244 px wide. */

type Box = { left: number; top: number; width: number; height: number };

function lines(el: Element): { text: string; box: Box }[] {
  const out: { text: string; box: Box }[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const rows: { top: number; text: string; l: number; r: number; t: number; b: number }[] = [];
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    const s = n.data;
    const re = /\S+\s*/g;
    for (let m = re.exec(s); m; m = re.exec(s)) {
      const r = document.createRange();
      r.setStart(n, m.index); r.setEnd(n, m.index + m[0].trimEnd().length);
      const b = r.getBoundingClientRect();
      if (b.width === 0 && b.height === 0) continue;
      const piece = m[0].replace(/\u00a0/g, " ");
      const row = rows.find((x) => Math.abs(x.top - b.top) < b.height / 2);
      if (row) { row.text += (/\s$/.test(row.text) ? "" : " ") + piece; row.l = Math.min(row.l, b.left); row.r = Math.max(row.r, b.right); }
      else rows.push({ top: b.top, text: piece, l: b.left, r: b.right, t: b.top, b: b.bottom });
    }
  }
  for (const r of rows) out.push({ text: r.text.trim(), box: { left: r.l, top: r.t, width: r.r - r.l, height: r.b - r.t } });
  return out;
}

const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

export async function drawQuote(card: HTMLElement): Promise<Blob> {
  const root = card.querySelector<HTMLElement>(".qc");
  if (!root) throw new Error("no card");
  await document.fonts?.ready;
  const rb = root.getBoundingClientRect();
  const k = 1244 / rb.width;
  const W = 1244, H = Math.round(rb.height * k);
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
  const at = (b: Box) => ({ x: (b.left - rb.left) * k, y: (b.top - rb.top) * k, w: b.width * k, h: b.height * k });

  /* frame */
  const fr = root.querySelector(".qc-frame")!; const fcs = getComputedStyle(fr);
  const fb = at(fr.getBoundingClientRect()); const fw = parseFloat(fcs.borderTopWidth) * k;
  ctx.strokeStyle = fcs.borderTopColor; ctx.lineWidth = fw; ctx.strokeRect(fb.x + fw / 2, fb.y + fw / 2, fb.w - fw, fb.h - fw);

  /* table: cell backgrounds and borders first */
  const tbl = root.querySelector("table")!;
  for (const c of Array.from(tbl.querySelectorAll("th, td"))) {
    const cs = getComputedStyle(c); const b = at(c.getBoundingClientRect());
    ctx.fillStyle = cs.backgroundColor === "rgba(0, 0, 0, 0)" ? "#fff" : cs.backgroundColor; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = cs.borderTopColor; ctx.lineWidth = parseFloat(cs.borderTopWidth) * k; ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
  const tcs = getComputedStyle(tbl); const tb = at(tbl.getBoundingClientRect());
  ctx.strokeStyle = tcs.borderTopColor; ctx.lineWidth = parseFloat(tcs.borderTopWidth) * k * 1.5; ctx.strokeRect(tb.x, tb.y, tb.w, tb.h);

  /* every piece of text, in the font and spacing the page uses */
  const textEls = Array.from(root.querySelectorAll("h2, th, td, .qc-total, .qc-note, .qc-brand"));
  for (const el of textEls) {
    const cs = getComputedStyle(el);
    if (el.classList.contains("qc-brand")) { const b = at(el.getBoundingClientRect()); ctx.fillStyle = cs.backgroundColor; ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, parseFloat(cs.borderTopLeftRadius) * k); ctx.fill(); }
    const px = parseFloat(cs.fontSize) * k;
    ctx.font = `${cs.fontStyle === "italic" ? "italic " : ""}${cs.fontWeight} ${px}px ${cs.fontFamily}`;
    ctx.fillStyle = cs.color; ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
    const ls = cs.letterSpacing === "normal" ? 0 : parseFloat(cs.letterSpacing) * k;
    (ctx as unknown as { letterSpacing: string }).letterSpacing = `${ls}px`;
    const upper = cs.textTransform === "uppercase";
    for (const ln of lines(el)) {
      const b = at(ln.box); const t = upper ? ln.text.toLocaleUpperCase() : ln.text;
      ctx.fillText(t, b.x, b.y + b.h / 2 + px * 0.34);
    }
  }
  (ctx as unknown as { letterSpacing: string }).letterSpacing = "0px";

  /* product pictures */
  for (const im of Array.from(root.querySelectorAll<HTMLImageElement>(".qc-imgs img"))) {
    const b = at(im.getBoundingClientRect()); const img = await loadImg(im.src);
    const s = Math.min(b.w / img.width, b.h / img.height); const w = img.width * s, h = img.height * s;
    ctx.drawImage(img, b.x + (b.w - w) / 2, b.y + (b.h - h), w, h);
  }
  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("export failed"))), "image/png"));
}
