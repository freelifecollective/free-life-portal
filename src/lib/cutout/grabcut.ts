/**
 * In-page background removal for portrait photos (no model download): colour-histogram GrabCut with a
 * graph cut, then guided-filter edge refinement. Pure functions on typed arrays.
 *
 * This is the fallback used when the segmentation model cannot load (offline, blocked, old browser).
 * It struggles on busy backgrounds and dark hair on dark backgrounds, which is why the touch-up brush exists.
 */
const NB = 10; /* histogram levels per colour channel */
const NBINS = NB * NB * NB;
const INF = 1e6;
const PRIOR_HEAD = 5.0;
const PRIOR_BODY = 1.6;

function binOf(r: number, g: number, b: number): number {
  return ((((r * NB) / 256) | 0) * NB + (((g * NB) / 256) | 0)) * NB + (((b * NB) / 256) | 0);
}

/** Rough prior for a centred portrait: edges and upper corners are background, face and lower middle are subject. */
export function seeds(w: number, h: number): Uint8Array {
  const L = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const v = (y + 0.5) / h;
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      const dx = (u - 0.5) / 0.13, dy = (v - 0.4) / 0.17;
      const fg = dx * dx + dy * dy < 1 || (v > 0.74 && Math.abs(u - 0.5) < 0.06 + (v - 0.74) * 0.9);
      const bg = v < 0.03 || ((u < 0.05 || u > 0.95) && v < 0.7) || ((u < 0.16 || u > 0.84) && v < 0.22);
      L[y * w + x] = fg ? 1 : bg ? 2 : 0;
    }
  }
  return L;
}

/** Smoothed log-cost table for one class (-ln P(colour | class)). */
function costTable(px: Uint8ClampedArray, n: number, label: Uint8Array, want: number): Float32Array {
  const H = new Float32Array(NBINS);
  const out = new Float32Array(NBINS);
  const eps = 0.05;
  let sum = 0;
  for (let i = 0; i < n; i++) if (label[i] === want) H[binOf(px[i * 4], px[i * 4 + 1], px[i * 4 + 2])] += 1;
  for (let r = 0; r < NB; r++) for (let g = 0; g < NB; g++) for (let b = 0; b < NB; b++) {
    let s = 0;
    for (let dr = -1; dr <= 1; dr++) {
      const rr = r + dr; if (rr < 0 || rr >= NB) continue;
      for (let dg = -1; dg <= 1; dg++) {
        const gg = g + dg; if (gg < 0 || gg >= NB) continue;
        for (let db = -1; db <= 1; db++) {
          const bb = b + db; if (bb < 0 || bb >= NB) continue;
          s += H[(rr * NB + gg) * NB + bb] * (dr || dg || db ? 0.5 : 1);
        }
      }
    }
    out[(r * NB + g) * NB + b] = s;
    sum += s;
  }
  for (let i = 0; i < NBINS; i++) out[i] = -Math.log((out[i] + eps) / (sum + eps * NBINS));
  return out;
}

/** Dinic max-flow on a flat edge list. */
class Graph {
  m = 0;
  head: Int32Array;
  nxt: Int32Array;
  to: Int32Array;
  cap: Float64Array;
  constructor(public n: number, maxE: number) {
    this.head = new Int32Array(n).fill(-1);
    this.nxt = new Int32Array(maxE);
    this.to = new Int32Array(maxE);
    this.cap = new Float64Array(maxE);
  }
  add(u: number, v: number, c: number, rc: number) {
    const m = this.m;
    this.to[m] = v; this.cap[m] = c; this.nxt[m] = this.head[u]; this.head[u] = m;
    this.to[m + 1] = u; this.cap[m + 1] = rc; this.nxt[m + 1] = this.head[v]; this.head[v] = m + 1;
    this.m += 2;
  }
  /** Returns the source side of the min cut. */
  maxflow(s: number, t: number): Uint8Array {
    const { n, head, nxt, to, cap } = this;
    const EPS = 1e-9;
    const level = new Int32Array(n), it = new Int32Array(n), q = new Int32Array(n), pe = new Int32Array(n + 1);
    const bfs = () => {
      level.fill(-1); level[s] = 0;
      let qh = 0, qt = 0; q[qt++] = s;
      while (qh < qt) {
        const u = q[qh++];
        for (let e = head[u]; e !== -1; e = nxt[e]) {
          const v = to[e];
          if (cap[e] > EPS && level[v] < 0) { level[v] = level[u] + 1; q[qt++] = v; }
        }
      }
      return level[t] >= 0;
    };
    while (bfs()) {
      for (let i = 0; i < n; i++) it[i] = head[i];
      let depth = 0, u = s;
      for (;;) {
        if (u === t) {
          let f = Infinity;
          for (let k = 0; k < depth; k++) if (cap[pe[k]] < f) f = cap[pe[k]];
          let first = -1;
          for (let k = 0; k < depth; k++) {
            cap[pe[k]] -= f; cap[pe[k] ^ 1] += f;
            if (first < 0 && cap[pe[k]] <= EPS) first = k;
          }
          depth = first; u = to[pe[first] ^ 1];
          continue;
        }
        let e = it[u];
        while (e !== -1 && !(cap[e] > EPS && level[to[e]] === level[u] + 1)) e = nxt[e];
        it[u] = e;
        if (e !== -1) { pe[depth++] = e; u = to[e]; }
        else {
          if (u === s) break;
          level[u] = -1; depth--; u = to[pe[depth] ^ 1];
        }
      }
    }
    const side = new Uint8Array(n);
    let qh = 0, qt = 0; q[qt++] = s; side[s] = 1;
    while (qh < qt) {
      const u = q[qh++];
      for (let e = head[u]; e !== -1; e = nxt[e]) {
        const v = to[e];
        if (cap[e] > EPS && !side[v]) { side[v] = 1; q[qt++] = v; }
      }
    }
    return side;
  }
}

const NEI = [[1, 0], [0, 1], [1, 1], [-1, 1]];

/** Extra cost of calling a pixel background where a person usually is: head and hair, and shoulders. */
function prior(w: number, h: number): Float32Array {
  const P = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const v = (y + 0.5) / h;
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      const dx = (u - 0.48) / 0.29, dy = (v - 0.36) / 0.34, r = dx * dx + dy * dy;
      let b = r < 1 ? PRIOR_HEAD * Math.min(1, (1 - r) * 3) : 0;
      if (v > 0.55) {
        const t = 0.2 + (v - 0.55) * 0.9 - Math.abs(u - 0.5);
        if (t > 0) b = Math.max(b, PRIOR_BODY * Math.min(1, t / 0.12));
      }
      P[y * w + x] = b;
    }
  }
  return P;
}

export function segment(px: Uint8ClampedArray, w: number, h: number, opts: { gamma?: number; iters?: number } = {}): Float32Array {
  const gamma = opts.gamma || 24, iters = opts.iters || 4;
  const n = w * h, seedL = seeds(w, h), lab = new Uint8Array(n), bins = new Int16Array(n), pri = prior(w, h);
  for (let i = 0; i < n; i++) { lab[i] = seedL[i]; bins[i] = binOf(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]); }
  const pairs: number[] = [], dist: number[] = [];
  let sum = 0, cnt = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let k = 0; k < 4; k++) {
    const nx = x + NEI[k][0], ny = y + NEI[k][1];
    if (nx < 0 || nx >= w || ny >= h) continue;
    const i = y * w + x, j = ny * w + nx;
    let dc2 = 0;
    for (let d = 0; d < 3; d++) { const df = px[i * 4 + d] - px[j * 4 + d]; dc2 += df * df; }
    pairs.push(i, j, dc2); dist.push(k > 1 ? 0.7071 : 1);
    sum += dc2; cnt++;
  }
  const beta = 1 / (2 * (sum / cnt) + 1e-6);
  const S = n, T = n + 1, maxE = (pairs.length / 3) * 2 + n * 4 + 16;
  for (let iter = 0; iter < iters; iter++) {
    const fgCost = costTable(px, n, lab, 1), bgCost = costTable(px, n, lab, 2);
    const g = new Graph(n + 2, maxE);
    for (let p = 0; p < n; p++) {
      if (seedL[p] === 1) g.add(S, p, INF, 0);
      else if (seedL[p] === 2) g.add(p, T, INF, 0);
      else { g.add(S, p, bgCost[bins[p]] + pri[p], 0); g.add(p, T, fgCost[bins[p]], 0); }
    }
    for (let k = 0; k < pairs.length; k += 3) {
      const wgt = (gamma * Math.exp(-beta * pairs[k + 2])) / dist[k / 3] + 0.5;
      g.add(pairs[k], pairs[k + 1], wgt, wgt);
    }
    const side = g.maxflow(S, T);
    for (let p = 0; p < n; p++) lab[p] = side[p] ? 1 : 2;
  }
  return cleanup(lab, seedL, w, h);
}

/** Keep the connected region that holds the subject seeds and fill small holes. */
function cleanup(lab: Uint8Array, seedL: Uint8Array, w: number, h: number): Float32Array {
  const n = w * h, comp = new Int32Array(n).fill(-1), sizes: number[] = [], hits: number[] = [], st = new Int32Array(n);
  const neighbors = (idx: number, fn: (j: number) => void) => {
    const x = idx % w, y = (idx / w) | 0;
    if (x > 0) fn(idx - 1);
    if (x < w - 1) fn(idx + 1);
    if (y > 0) fn(idx - w);
    if (y < h - 1) fn(idx + w);
  };
  let c = 0;
  for (let i = 0; i < n; i++) {
    if (lab[i] !== 1 || comp[i] >= 0) continue;
    let qh = 0, qt = 0; st[qt++] = i; comp[i] = c; sizes[c] = 0; hits[c] = 0;
    while (qh < qt) {
      const u = st[qh++]; sizes[c]++; if (seedL[u] === 1) hits[c]++;
      neighbors(u, (v) => { if (lab[v] === 1 && comp[v] < 0) { comp[v] = c; st[qt++] = v; } });
    }
    c++;
  }
  let best = -1, bestHits = -1;
  for (let i = 0; i < c; i++) {
    if (hits[i] > bestHits || (hits[i] === bestHits && sizes[i] > sizes[best])) { best = i; bestHits = hits[i]; }
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = comp[i] === best ? 1 : 0;
  /* fill background pockets smaller than 1.2% of the frame that do not touch the border */
  const seen = new Uint8Array(n), limit = n * 0.012;
  for (let i = 0; i < n; i++) {
    if (out[i] !== 0 || seen[i]) continue;
    let qh = 0, qt = 0, touches = false, size = 0; st[qt++] = i; seen[i] = 1;
    while (qh < qt) {
      const u = st[qh++]; size++;
      const x = u % w, y = (u / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touches = true;
      neighbors(u, (v) => { if (out[v] === 0 && !seen[v]) { seen[v] = 1; st[qt++] = v; } });
    }
    if (!touches && size < limit) for (let k = 0; k < qt; k++) out[st[k]] = 1;
  }
  return out;
}

/* ---- refinement at display resolution ---- */
function boxMean(src: Float32Array, W: number, H: number, r: number): Float32Array {
  const tmp = new Float32Array(W * H), out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const o = y * W;
    let s = 0;
    for (let x = 0; x <= r && x < W; x++) s += src[o + x];
    for (let x = 0; x < W; x++) {
      const lo = x - r, hi = x + r;
      if (x > 0) { if (hi < W) s += src[o + hi]; if (lo - 1 >= 0) s -= src[o + lo - 1]; }
      tmp[o + x] = s / (Math.min(hi, W - 1) - Math.max(lo, 0) + 1);
    }
  }
  for (let x = 0; x < W; x++) {
    let s = 0;
    for (let y = 0; y <= r && y < H; y++) s += tmp[y * W + x];
    for (let y = 0; y < H; y++) {
      const lo = y - r, hi = y + r;
      if (y > 0) { if (hi < H) s += tmp[hi * W + x]; if (lo - 1 >= 0) s -= tmp[(lo - 1) * W + x]; }
      out[y * W + x] = s / (Math.min(hi, H - 1) - Math.max(lo, 0) + 1);
    }
  }
  return out;
}
function guided(I: Float32Array, P: Float32Array, W: number, H: number, r: number, eps: number): Float32Array {
  const n = W * H, II = new Float32Array(n), IP = new Float32Array(n);
  for (let i = 0; i < n; i++) { II[i] = I[i] * I[i]; IP[i] = I[i] * P[i]; }
  const mI = boxMean(I, W, H, r), mP = boxMean(P, W, H, r), mII = boxMean(II, W, H, r), mIP = boxMean(IP, W, H, r);
  const A = new Float32Array(n), B = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const vI = mII[i] - mI[i] * mI[i], cIP = mIP[i] - mI[i] * mP[i];
    A[i] = cIP / (vI + eps); B[i] = mP[i] - A[i] * mI[i];
  }
  const mA = boxMean(A, W, H, r), mB = boxMean(B, W, H, r), q = new Float32Array(n);
  for (let i = 0; i < n; i++) q[i] = mA[i] * I[i] + mB[i];
  return q;
}
function upsample(m: Float32Array, w: number, h: number, W: number, H: number): Float32Array {
  const out = new Float32Array(W * H);
  for (let Y = 0; Y < H; Y++) {
    const fy = ((Y + 0.5) * h) / H - 0.5, y0 = Math.max(0, Math.min(h - 1, Math.floor(fy))), y1 = Math.min(h - 1, y0 + 1);
    const ty = Math.max(0, Math.min(1, fy - y0));
    for (let X = 0; X < W; X++) {
      const fx = ((X + 0.5) * w) / W - 0.5, x0 = Math.max(0, Math.min(w - 1, Math.floor(fx))), x1 = Math.min(w - 1, x0 + 1);
      const tx = Math.max(0, Math.min(1, fx - x0));
      const a = m[y0 * w + x0], b = m[y0 * w + x1], c = m[y1 * w + x0], d = m[y1 * w + x1];
      out[Y * W + X] = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
    }
  }
  return out;
}
export function refine(maskSmall: Float32Array, w: number, h: number, guideRGBA: Uint8ClampedArray, W: number, H: number): Float32Array {
  const n = W * H, I = new Float32Array(n);
  const up = upsample(boxMean(maskSmall, w, h, 1), w, h, W, H);
  for (let i = 0; i < n; i++) I[i] = (0.299 * guideRGBA[i * 4] + 0.587 * guideRGBA[i * 4 + 1] + 0.114 * guideRGBA[i * 4 + 2]) / 255;
  const q = guided(I, up, W, H, Math.max(3, Math.round(W / 90)), 0.0008);
  for (let i = 0; i < n; i++) { const t = Math.max(0, Math.min(1, (q[i] - 0.12) / 0.5)); q[i] = t * t * (3 - 2 * t); }
  return q;
}
