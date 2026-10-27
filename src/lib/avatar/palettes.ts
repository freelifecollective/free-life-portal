/** Palettes and the random picture-set generator for the profile picture step. */

/** [backdrop start, backdrop end, accent for rings and patterns] */
export type Palette = readonly [string, string, string];

export const PALETTES: readonly Palette[] = [
  ["#AB9080", "#8C7263", "#F6F5F1"], ["#F6F5F1", "#E6DED3", "#AB9080"], ["#2B2522", "#4A3F3A", "#D9C3B5"],
  ["#C9B6A9", "#AB9080", "#FFFFFF"], ["#8FA396", "#5F7A6B", "#F6F5F1"], ["#9DB0BF", "#6C8499", "#F6F5F1"],
  ["#D8B4A0", "#B97F68", "#FFF8F2"], ["#B7A3C4", "#8A739B", "#FFFFFF"], ["#E8D9B5", "#C9AE72", "#FFFFFF"],
  ["#3E5C57", "#243B38", "#E9DCCB"], ["#F0E6E0", "#D7C2B7", "#AB9080"], ["#6E5E57", "#3F3531", "#E5D3C5"],
];

export type BackKind = "solid" | "gradient" | "rays" | "dots" | "rings" | "waves" | "grid" | "stripes" | "blobs";
export type RingKind =
  | "none" | "thin" | "double" | "triple" | "sparks" | "dots" | "beads" | "dashed" | "ticks" | "scallop" | "petals";
export type FilterKind = "none" | "warm" | "vivid" | "bright";
export type OutlineChoice = "outline" | "fancy" | "none";
export type BackgroundChoice = "texture" | "print" | "solid";
export type StyleChoice = { outline: OutlineChoice | null; bg: BackgroundChoice | null };

export type Spec = {
  seed: number;
  pal: number;
  back: BackKind;
  tone: 0 | 1;
  filter: FilterKind;
  it: boolean;
  ring: RingKind;
  zoom: number;
  /** reposition offsets as a fraction of the picture, and size multiplier (adjust step) */
  dx?: number;
  dy?: number;
  sz?: number;
};

/** No black and white filters: faces stay bright. */
const FILTERS: FilterKind[] = ["none", "none", "none", "warm", "vivid", "bright"];
export const BACK_KINDS: Record<BackgroundChoice, BackKind[]> = {
  texture: ["gradient", "blobs", "waves", "rays"],
  print: ["dots", "grid", "rings", "stripes"],
  solid: ["solid"],
};
const RING_OF: Record<OutlineChoice, RingKind> = { none: "none", outline: "thin", fancy: "double" };
export const FANCY: RingKind[] = ["sparks", "dots", "beads", "dashed", "ticks", "scallop", "triple", "petals"];

export function shuffle<T>(a: T[], random: () => number = Math.random): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pick<T>(arr: readonly T[], random: () => number): T {
  return arr[Math.floor(random() * arr.length)];
}

/** Ten designed options. Palettes never repeat inside a set. */
export function newBatch(style: StyleChoice, random: () => number = Math.random): Spec[] {
  const fancy = shuffle(FANCY.slice(), random);
  const idx = shuffle(PALETTES.map((_, i) => i), random).slice(0, 10);
  return idx.map((p, j) => ({
    seed: Math.floor(random() * 4294967296) >>> 0,
    pal: p,
    back: pick(BACK_KINDS[style.bg ?? "texture"], random),
    tone: random() < 0.5 ? 0 : 1,
    filter: pick(FILTERS, random),
    it: random() < 0.35,
    ring: style.outline === "fancy" ? fancy[j % fancy.length] : RING_OF[style.outline ?? "none"],
    zoom: 1 + random() * 0.06,
  }));
}

/** The six small examples on the style question. */
export const EXAMPLES: Record<OutlineChoice | BackgroundChoice, { back: BackKind; ring: RingKind }> = {
  outline: { back: "solid", ring: "thin" },
  fancy: { back: "solid", ring: "scallop" },
  none: { back: "solid", ring: "none" },
  texture: { back: "waves", ring: "none" },
  print: { back: "dots", ring: "none" },
  solid: { back: "solid", ring: "none" },
};
