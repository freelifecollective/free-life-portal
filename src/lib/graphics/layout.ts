/** Where things go on a template. Positions are percentages of the picture (x across, y down, to the centre of the thing), sizes are a percentage of the picture's width. */
export type TextEl = { on: boolean; x: number; y: number; size: number; color: string; align: "left" | "center" | "right"; bold: boolean };
export type Layout = {
  photo: { on: boolean; x: number; y: number; size: number; shape: "circle" | "square" };
  name: TextEl;
  link: TextEl;
  text: TextEl & { default: string };
};

export const DEFAULT_LAYOUT: Layout = {
  photo: { on: true, x: 50, y: 30, size: 26, shape: "circle" },
  name: { on: true, x: 50, y: 56, size: 5.5, color: "#FFFFFF", align: "center", bold: true },
  link: { on: true, x: 50, y: 90, size: 3.2, color: "#FFFFFF", align: "center", bold: false },
  text: { on: false, x: 50, y: 72, size: 4, color: "#FFFFFF", align: "center", bold: false, default: "Join me on a free community call" },
};

const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const hex = (v: unknown, d: string) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : d);
const text = (v: unknown, d: TextEl): TextEl => {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    on: o.on === true, x: num(o.x, 0, 100, d.x), y: num(o.y, 0, 100, d.y), size: num(o.size, 1, 20, d.size), color: hex(o.color, d.color),
    align: o.align === "left" || o.align === "right" ? o.align : "center", bold: o.bold === true,
  };
};

/** Makes sure whatever was saved (or sent) is a safe, complete layout. */
export function cleanLayout(v: unknown): Layout {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const p = (o.photo && typeof o.photo === "object" ? o.photo : {}) as Record<string, unknown>;
  const t = (o.text && typeof o.text === "object" ? o.text : {}) as Record<string, unknown>;
  return {
    photo: { on: p.on === true, x: num(p.x, 0, 100, 50), y: num(p.y, 0, 100, 30), size: num(p.size, 3, 80, 26), shape: p.shape === "square" ? "square" : "circle" },
    name: text(o.name, DEFAULT_LAYOUT.name),
    link: text(o.link, DEFAULT_LAYOUT.link),
    text: { ...text(o.text, DEFAULT_LAYOUT.text), default: typeof t.default === "string" ? t.default.slice(0, 140) : "" },
  };
}
