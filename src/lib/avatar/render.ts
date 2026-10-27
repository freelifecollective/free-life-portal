import { FANCY, PALETTES, type BackKind, type FilterKind, type RingKind, type Spec } from "./palettes";

/** Everything render() needs besides the spec. */
export type RenderContext = {
  mode: "own" | "gen" | "avatar";
  /** use the background-removed person instead of the original photo */
  useCut: boolean;
  /** 1024px square person with transparent background (after cutout) */
  person: HTMLCanvasElement | null;
  /** 1024px square original photo crop */
  src: HTMLCanvasElement | null;
  /** letters for the monogram avatar */
  initials: string;
  /** CSS font-family list for the monogram (the loaded Playfair Display) */
  displayFont: string;
};

type Ctx = CanvasRenderingContext2D;

export function rng(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hex(h: string): [number, number, number] {
  const s = h.replace("#", "");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
export function rgba(h: string, a: number): string {
  const c = hex(h);
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}
function lum(h: string): number {
  const c = hex(h);
  return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
}

function backdrop(x: Ctx, S: number, kind: BackKind, pc: string, rnd: () => number) {
  x.save();
  if (kind === "rays") {
    const n = 12 + Math.floor(rnd() * 6) * 2;
    const a0 = rnd() * Math.PI;
    x.fillStyle = rgba(pc, 0.16);
    for (let k = 0; k < n; k += 2) {
      x.beginPath();
      x.moveTo(S / 2, S / 2);
      x.arc(S / 2, S / 2, S * 1.2, a0 + (k * 2 * Math.PI) / n, a0 + ((k + 1) * 2 * Math.PI) / n);
      x.closePath();
      x.fill();
    }
  } else if (kind === "dots") {
    const step = S * 0.065;
    x.fillStyle = rgba(pc, 0.3);
    for (let j = 0; j * step < S + step; j++) {
      for (let i = 0; i * step < S + step; i++) {
        x.beginPath();
        x.arc(i * step + (j % 2 ? step / 2 : 0), j * step, S * 0.01, 0, Math.PI * 2);
        x.fill();
      }
    }
  } else if (kind === "rings") {
    x.strokeStyle = rgba(pc, 0.26);
    x.lineWidth = S * 0.008;
    for (let i = S * 0.28; i < S * 0.85; i += S * 0.07) {
      x.beginPath();
      x.arc(S / 2, S / 2, i, 0, Math.PI * 2);
      x.stroke();
    }
  } else if (kind === "waves") {
    for (let k = 0; k < 5; k++) {
      const y0 = S * (0.4 + k * 0.12);
      const amp = S * (0.03 + rnd() * 0.03);
      const ph = rnd() * 6.28;
      x.beginPath();
      x.moveTo(0, S);
      for (let px = 0; px <= S; px += S / 40) x.lineTo(px, y0 + Math.sin((px / S) * Math.PI * 2.6 + ph) * amp);
      x.lineTo(S, S);
      x.closePath();
      x.fillStyle = rgba(pc, 0.1 + k * 0.025);
      x.fill();
    }
  } else if (kind === "grid") {
    const step = S * 0.08;
    x.strokeStyle = rgba(pc, 0.22);
    x.lineWidth = S * 0.004;
    for (let i = 0; i <= S; i += step) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.stroke();
      x.beginPath(); x.moveTo(0, i); x.lineTo(S, i); x.stroke();
    }
  } else if (kind === "stripes") {
    const step = S * 0.13;
    x.strokeStyle = rgba(pc, 0.2);
    x.lineWidth = S * 0.045;
    for (let i = -S; i < S * 2; i += step) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i + S, S); x.stroke();
    }
  } else if (kind === "blobs") {
    for (let k = 0; k < 5; k++) {
      const bx = rnd() * S, by = rnd() * S, br = S * (0.2 + rnd() * 0.25);
      const g = x.createRadialGradient(bx, by, 0, bx, by, br);
      g.addColorStop(0, rgba(pc, 0.4));
      g.addColorStop(1, rgba(pc, 0));
      x.fillStyle = g;
      x.fillRect(0, 0, S, S);
    }
  }
  x.restore();
}

function sparkle(x: Ctx, cx: number, cy: number, r: number, fill: string) {
  x.beginPath();
  x.moveTo(cx, cy - r);
  x.quadraticCurveTo(cx, cy, cx + r, cy);
  x.quadraticCurveTo(cx, cy, cx, cy + r);
  x.quadraticCurveTo(cx, cy, cx - r, cy);
  x.quadraticCurveTo(cx, cy, cx, cy - r);
  x.closePath();
  x.fillStyle = fill;
  x.fill();
}

function tint(ctx: Ctx, P: number, kind: FilterKind) {
  if (kind === "none") return;
  const id = ctx.getImageData(0, 0, P, P);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    if (kind === "warm") { d[i] = r * 1.06 + 5; d[i + 1] = g * 1.01; d[i + 2] = b * 0.91; }
    else if (kind === "vivid") {
      d[i] = (l + (r - l) * 1.35 - 128) * 1.05 + 128;
      d[i + 1] = (l + (g - l) * 1.35 - 128) * 1.05 + 128;
      d[i + 2] = (l + (b - l) * 1.35 - 128) * 1.05 + 128;
    } else if (kind === "bright") { d[i] = r * 1.07 + 8; d[i + 1] = g * 1.07 + 8; d[i + 2] = b * 1.07 + 8; }
  }
  ctx.putImageData(id, 0, 0);
}

function drawMonogram(x: Ctx, S: number, spec: Spec, rc: RenderContext) {
  const pal = PALETTES[spec.pal];
  const ini = rc.initials || "?";
  const base = spec.back === "solid" ? pal[spec.tone] : null;
  const lb = base ? lum(base) : (lum(pal[0]) + lum(pal[1])) / 2;
  const fs = Math.round(S * (ini.length > 1 ? 0.36 : 0.46));
  x.save();
  x.font = `${spec.it ? "italic " : ""}600 ${fs}px ${rc.displayFont}`;
  x.textAlign = "center";
  x.textBaseline = "middle";
  try { (x as Ctx & { letterSpacing: string }).letterSpacing = Math.round(S * 0.012) + "px"; } catch { /* optional */ }
  x.fillStyle = lb > 0.6 ? "#2B2522" : "#FFFFFF";
  x.shadowColor = lb > 0.6 ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.18)";
  x.shadowBlur = S * 0.02;
  x.shadowOffsetY = S * 0.006;
  x.fillText(ini, S / 2 + S * 0.006, S / 2 + fs * 0.05);
  x.restore();
}

/** Borders: two plain ones and a set of fancy ones so a batch shows variety. */
function drawRing(x: Ctx, S: number, ring: RingKind, col: string, rnd: () => number) {
  if (ring === "none") return;
  const c = S / 2, R = S / 2 - S * 0.032, w = S * 0.014;
  const circ = (rad: number, lw: number, al: number) => {
    x.beginPath(); x.arc(c, c, rad, 0, Math.PI * 2); x.lineWidth = lw; x.globalAlpha = al; x.stroke(); x.globalAlpha = 1;
  };
  x.save();
  x.strokeStyle = rgba(col, 0.95);
  x.fillStyle = rgba(col, 0.95);
  x.lineCap = "round";
  if (ring === "thin") circ(R, w, 1);
  else if (ring === "double") { circ(R, w, 1); circ(R - w * 3.2, w * 0.5, 0.65); }
  else if (ring === "triple") { circ(R, w * 1.5, 1); circ(R - w * 3, w * 0.5, 0.7); circ(R - w * 5, w * 0.35, 0.5); }
  else if (ring === "sparks") {
    circ(R, w, 1); circ(R - w * 3.2, w * 0.5, 0.65);
    const anchors = [[0.2, 0.2], [0.8, 0.22], [0.13, 0.5], [0.87, 0.48], [0.32, 0.1], [0.68, 0.1]];
    const k = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < k; i++) {
      const an = anchors[(Math.floor(rnd() * 6) + i) % 6];
      sparkle(x, an[0] * S, an[1] * S, S * (0.02 + rnd() * 0.025), rgba(col, 0.95));
    }
  } else if (ring === "dots") {
    circ(R, w * 0.6, 0.8);
    const n = 40;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      x.beginPath(); x.arc(c + Math.cos(a) * (R - w * 3), c + Math.sin(a) * (R - w * 3), w * 0.75, 0, Math.PI * 2); x.fill();
    }
  } else if (ring === "beads") {
    const n = 30;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      x.beginPath(); x.arc(c + Math.cos(a) * (R - w * 1.5), c + Math.sin(a) * (R - w * 1.5), w * 1.5, 0, Math.PI * 2); x.fill();
    }
  } else if (ring === "dashed") {
    x.setLineDash([w * 3.2, w * 2.2]); circ(R - w * 0.5, w * 1.2, 1); x.setLineDash([]); circ(R - w * 3.8, w * 0.4, 0.6);
  } else if (ring === "ticks") {
    circ(R - w * 3.6, w * 0.4, 0.7);
    const n = 72;
    x.lineWidth = w * 0.5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = i % 6 === 0 ? w * 3.2 : w * 1.6;
      x.beginPath(); x.moveTo(c + Math.cos(a) * R, c + Math.sin(a) * R); x.lineTo(c + Math.cos(a) * (R - r), c + Math.sin(a) * (R - r)); x.stroke();
    }
  } else if (ring === "scallop") {
    const n = 24;
    const r = ((Math.PI * R) / n) * 0.95;
    const rc = R - r * 0.55;
    x.lineWidth = w * 0.8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      x.beginPath(); x.arc(c + Math.cos(a) * rc, c + Math.sin(a) * rc, r, 0, Math.PI * 2); x.stroke();
    }
  } else if (ring === "petals") {
    const n = 16;
    x.lineWidth = w * 0.7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      x.save(); x.translate(c, c); x.rotate(a); x.beginPath();
      x.ellipse(R - w * 4.5, 0, w * 3.8, w * 1.5, 0, 0, Math.PI * 2); x.globalAlpha = 0.9; x.stroke(); x.restore();
    }
    circ(R, w * 0.6, 0.8);
  }
  x.restore();
}

/** Full-bleed square; it reads as a circle because every design sits inside the inscribed circle. */
export function renderAvatar(spec: Spec, S: number, rc: RenderContext): HTMLCanvasElement {
  const rnd = rng(spec.seed);
  const pal = PALETTES[spec.pal];
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const x = c.getContext("2d")!;
  const pc = lum(pal[0]) > 0.62 ? pal[2] : "#FFFFFF";
  const avatar = rc.mode === "avatar";
  const cutting = !avatar && rc.useCut && !!rc.person;

  if (spec.back === "solid") {
    x.fillStyle = pal[spec.tone];
    x.fillRect(0, 0, S, S);
  } else {
    const ang = rnd() * Math.PI * 2, ca = (Math.cos(ang) * S) / 2, sa = (Math.sin(ang) * S) / 2;
    const g = x.createLinearGradient(S / 2 - ca, S / 2 - sa, S / 2 + ca, S / 2 + sa);
    g.addColorStop(0, pal[0]);
    g.addColorStop(1, pal[1]);
    x.fillStyle = g;
    x.fillRect(0, 0, S, S);
    backdrop(x, S, spec.back, pc, rnd);
    const rg = x.createRadialGradient(S / 2, S * 0.45, S * 0.08, S / 2, S * 0.45, S * 0.55);
    rg.addColorStop(0, "rgba(255,255,255,.2)");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = rg;
    x.fillRect(0, 0, S, S);
  }
  if (cutting || avatar) drawRing(x, S, spec.ring, pc, rnd); /* the border sits behind the person */
  if (avatar) { drawMonogram(x, S, spec, rc); return c; }

  /* the person, anchored to the bottom so the head keeps its room */
  const P = Math.round(S * (cutting ? spec.zoom * (spec.sz || 1) : 1));
  const t = document.createElement("canvas");
  t.width = t.height = P;
  const tc = t.getContext("2d")!;
  tc.imageSmoothingQuality = "high";
  tc.drawImage((cutting ? rc.person : rc.src) as HTMLCanvasElement, 0, 0, P, P);
  tint(tc, P, spec.filter);
  x.save();
  if (cutting) { x.shadowColor = "rgba(43,37,34,.25)"; x.shadowBlur = S * 0.03; x.shadowOffsetY = S * 0.008; }
  x.drawImage(t, Math.round((S - P) / 2 + (spec.dx || 0) * S), Math.round(S - P + (spec.dy || 0) * S));
  x.restore();
  if (!cutting) drawRing(x, S, spec.ring, "#FFFFFF", rnd);
  return c;
}

export { FANCY };
