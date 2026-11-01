import type { TreeNode } from "./layout";

/** The ranks a bubble can have. "6A2-3+" means 6A2-3 and above. */
export const TREE_RANKS = ["1A", "2A", "3A", "4A", "5A", "6A", "6A2", "6A2-2", "6A2-3+"] as const;

export type Swatch = { key: string; label: string; fill: string; stroke: string };
export const OWNED: Swatch = { key: "owned", label: "My accounts", fill: "#FFE9A8", stroke: "#C99700" };
const NONE: Swatch = { key: "none", label: "No rank", fill: "#F1EFE9", stroke: "#B9A797" };
export const RANK_SWATCHES: Swatch[] = [
  { key: "1-3", label: "1A-3A", fill: "#DCEEDF", stroke: "#6FA77F" },
  { key: "4-5", label: "4A-5A", fill: "#D9E8F7", stroke: "#5E8FC4" },
  { key: "6", label: "6A", fill: "#E4DAF3", stroke: "#8A6CC0" },
  { key: "62", label: "6A2", fill: "#F8D9E4", stroke: "#C4607F" },
  { key: "62-2", label: "6A2-2", fill: "#CFEDEA", stroke: "#3E9C94" },
  { key: "62-3", label: "6A2-3 and above", fill: "#EAD3C2", stroke: "#A8643A" },
];
export const LEGEND: Swatch[] = [OWNED, ...RANK_SWATCHES];

export function rankKey(rank: string | null | undefined): string | null {
  switch (rank) {
    case "1A": case "2A": case "3A": return "1-3";
    case "4A": case "5A": return "4-5";
    case "6A": return "6";
    case "6A2": return "62";
    case "6A2-2": return "62-2";
    case "6A2-3+": case "6A+": return "62-3";
    default: return null;
  }
}

/** The colour of a bubble: one colour for the owner's own accounts, otherwise by rank. */
export function swatchOf(n: Pick<TreeNode, "rank" | "owned">): Swatch {
  if (n.owned) return OWNED;
  const k = rankKey(n.rank);
  return RANK_SWATCHES.find((s) => s.key === k) ?? NONE;
}
