import type { TreeNode } from "./layout";

/** Ten example accounts for the locked "Your Organization" preview (made up, nobody real). */
const n = (id: string, parent: string | null, side: "left" | "right", label: string, rank: string): TreeNode => ({ id: `demo-${id}`, parent_id: parent ? `demo-${parent}` : null, side, label, rank });
export const DEMO_TREE: TreeNode[] = [
  n("1", null, "left", "Maya", "3A"), n("2", null, "right", "Jordan", "3A"),
  n("3", "1", "left", "Priya", "2A"), n("4", "1", "right", "Chris", "2A"),
  n("5", "2", "left", "Alex", "2A"), n("6", "2", "right", "Sam", "2A"),
  n("7", "3", "left", "Taylor", "1A"), n("8", "3", "right", "Morgan", "1A"),
  n("9", "5", "left", "Riley", "1A"), n("10", "6", "right", "Casey", "1A"),
];
