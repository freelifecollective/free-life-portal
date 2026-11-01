import type { TreeNode } from "./layout";

/** The ranks a bubble can have. 6A2-3 up to 6A2-8 share one colour ("6A2-3 and above"). */
export const TREE_RANKS = ["1A", "2A", "3A", "4A", "5A", "6A", "6A2", "6A2-2", "6A2-3", "6A2-4", "6A2-5", "6A2-6", "6A2-7", "6A2-8"] as const;

export type Swatch = { key: string; label: string; fill: string; stroke: string };
export const OWNED: Swatch = { key: "owned", label: "My accounts", fill: "#AB9080", stroke: "#8D7364" };
const NONE: Swatch = { key: "none", label: "No rank", fill: "#F1EFE9", stroke: "#B9A797" };
export const RANK_SWATCHES: Swatch[] = [
  { key: "1-3", label: "1A-3A", fill: "#E3E3E3", stroke: "#8F8F8F" },
  { key: "4-5", label: "4A-5A", fill: "#D6E9FA", stroke: "#5A9BD5" },
  { key: "6", label: "6A", fill: "#CDEBD3", stroke: "#4FA066" },
  { key: "62", label: "6A2", fill: "#E1D5F3", stroke: "#8A6CC0" },
  { key: "62-2", label: "6A2-2", fill: "#FBF0B8", stroke: "#C9A81A" },
  { key: "62-3", label: "6A2-3 and above", fill: "#FBD9B0", stroke: "#DE8A1E" },
];
export const LEGEND: Swatch[] = [OWNED, ...RANK_SWATCHES];

export function rankKey(rank: string | null | undefined): string | null {
  switch (rank) {
    case "1A": case "2A": case "3A": return "1-3";
    case "4A": case "5A": return "4-5";
    case "6A": return "6";
    case "6A2": return "62";
    case "6A2-2": return "62-2";
    case "6A2-3": case "6A2-4": case "6A2-5": case "6A2-6": case "6A2-7": case "6A2-8": case "6A2-3+": case "6A+": return "62-3";
    default: return null;
  }
}

/** The colour of a bubble: one colour for the owner's own accounts, otherwise by rank. */
export function swatchOf(n: Pick<TreeNode, "rank" | "owned">): Swatch {
  if (n.owned) return OWNED;
  const k = rankKey(n.rank);
  return RANK_SWATCHES.find((s) => s.key === k) ?? NONE;
}
