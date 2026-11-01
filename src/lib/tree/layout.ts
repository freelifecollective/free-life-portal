export type TreeNode = { id: string; parent_id: string | null; side: "left" | "right"; label: string; rank: string | null; linked_member_id?: string | null };
export type Side = "left" | "right";

/** One bubble with its two sides. The very top (the owner) has no node. */
export type Built = { node: TreeNode | null; left: Built | null; right: Built | null };

export function buildTree(nodes: TreeNode[]): Built {
  const by = new Map<string, Built>();
  for (const n of nodes) by.set(n.id, { node: n, left: null, right: null });
  const root: Built = { node: null, left: null, right: null };
  for (const n of nodes) {
    const b = by.get(n.id)!;
    const parent = n.parent_id ? by.get(n.parent_id) : root;
    if (parent) parent[n.side] = b;
  }
  return root;
}

/** How many bubbles are in this branch, counting itself (the owner at the very top does not count). */
export function countAll(b: Built | null): number {
  if (!b) return 0;
  return (b.node ? 1 : 0) + countAll(b.left) + countAll(b.right);
}

/** Lopsided: one side has at least two more accounts and at least one and a half times as many as the other. */
export function isLopsided(left: number, right: number): boolean {
  const hi = Math.max(left, right), lo = Math.min(left, right);
  return hi - lo >= 2 && hi >= 1.5 * lo;
}

export type Balance = { left: number; right: number; lopsided: boolean; heavy: Side | null };
export function balanceOf(b: Built): Balance {
  const left = countAll(b.left), right = countAll(b.right);
  const lopsided = isLopsided(left, right);
  return { left, right, lopsided, heavy: lopsided ? (left > right ? "left" : "right") : null };
}

export type Placed = { key: string; node: TreeNode | null; x: number; y: number; parentKey: string | null; side: Side | null; lopsided: boolean; left: number; right: number };
export type Phantom = { key: string; x: number; y: number; parentKey: string; parentId: string | null; side: Side };
export type Laid = { placed: Placed[]; phantoms: Phantom[]; width: number; height: number; heavyRoot: Side | null };

const SLOT = 116, ROW = 124, PAD = 56;

/**
 * Lays the tree out: every bubble sits between its two sides. A bubble with only one side gets an empty spot on the other
 * (shown as a "+" in the editor), so branches never run into each other.
 */
export function layoutTree(root: Built): Laid {
  const placed: Placed[] = [];
  const phantoms: Phantom[] = [];
  let maxDepth = 0;
  function place(b: Built, depth: number, start: number, parentKey: string | null, side: Side | null): { x: number; next: number } {
    maxDepth = Math.max(maxDepth, depth);
    const key = b.node?.id ?? "root";
    const hasKids = !!(b.left || b.right) || b.node === null;
    const mk = (s: Side, from: number): { x: number; next: number } => {
      const child = b[s];
      if (child) return place(child, depth + 1, from, key, s);
      if (!hasKids && b.node) return { x: from + 0.5, next: from + 1 };
      phantoms.push({ key: `${key}:${s}`, x: 0, y: (depth + 1) * ROW, parentKey: key, parentId: b.node?.id ?? null, side: s });
      maxDepth = Math.max(maxDepth, depth + 1);
      return { x: from + 0.5, next: from + 1 };
    };
    if (!hasKids) {
      placed.push({ key, node: b.node, x: start + 0.5, y: depth * ROW, parentKey, side, lopsided: false, left: 0, right: 0 });
      return { x: start + 0.5, next: start + 1 };
    }
    const l = mk("left", start);
    const r = mk("right", l.next);
    const left = countAll(b.left), right = countAll(b.right);
    const x = (l.x + r.x) / 2;
    placed.push({ key, node: b.node, x, y: depth * ROW, parentKey, side, lopsided: b.node ? left + right >= 3 && isLopsided(left, right) : false, left, right });
    const ph = phantoms.filter((p) => p.parentKey === key && p.x === 0);
    for (const p of ph) p.x = p.side === "left" ? l.x : r.x;
    return { x, next: r.next };
  }
  const end = place(root, 0, 0, null, null);
  const slots = Math.max(1, end.next);
  for (const p of placed) { p.x = p.x * SLOT + PAD; p.y += PAD; }
  for (const p of phantoms) { p.x = p.x * SLOT + PAD; p.y += PAD; }
  return { placed, phantoms, width: slots * SLOT + PAD * 2, height: maxDepth * ROW + PAD * 2 + 40, heavyRoot: balanceOf(root).heavy };
}

export const NODE_R = 38;
