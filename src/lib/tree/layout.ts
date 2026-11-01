export type TreeNode = { id: string; parent_id: string | null; side: "left" | "right"; label: string; rank: string | null; linked_member_id?: string | null; owned?: boolean };
export type Side = "left" | "right";

/** One account with everything under it. The left side and the right side can each hold as many accounts as you like. The very top (the owner) has no node. */
export type Built = { node: TreeNode | null; lefts: Built[]; rights: Built[] };

export function buildTree(nodes: TreeNode[]): Built {
  const by = new Map<string, Built>();
  for (const n of nodes) by.set(n.id, { node: n, lefts: [], rights: [] });
  const root: Built = { node: null, lefts: [], rights: [] };
  for (const n of nodes) {
    const b = by.get(n.id)!;
    const parent = n.parent_id ? by.get(n.parent_id) : root;
    if (parent) parent[n.side === "left" ? "lefts" : "rights"].push(b);
  }
  return root;
}

/** How many bubbles are in this branch, counting itself (the owner at the very top does not count). */
export function countAll(b: Built | null): number {
  if (!b) return 0;
  return (b.node ? 1 : 0) + countSide(b.lefts) + countSide(b.rights);
}
/** How many accounts are in a whole side (a list of branches). */
export function countSide(list: Built[]): number { return list.reduce((n, c) => n + countAll(c), 0); }

/** Lopsided: one side has at least two more accounts and at least one and a half times as many as the other. */
export function isLopsided(left: number, right: number): boolean {
  const hi = Math.max(left, right), lo = Math.min(left, right);
  return hi - lo >= 2 && hi >= 1.5 * lo;
}

export type Balance = { left: number; right: number; lopsided: boolean; heavy: Side | null };
export function balanceOf(b: Built): Balance {
  const left = countSide(b.lefts), right = countSide(b.rights);
  const lopsided = isLopsided(left, right);
  return { left, right, lopsided, heavy: lopsided ? (left > right ? "left" : "right") : null };
}

export type Placed = { key: string; node: TreeNode | null; x: number; y: number; parentKey: string | null; side: Side | null; lopsided: boolean; left: number; right: number };
export type Phantom = { key: string; x: number; y: number; parentKey: string; parentId: string | null; side: Side };
export type Laid = { placed: Placed[]; phantoms: Phantom[]; width: number; height: number; heavyRoot: Side | null; r: number; row: number };

/** Bubbles start big and shrink slowly as the tree grows (full size up to 7 accounts, smallest from about 90). */
export function bubbleRadius(count: number): number {
  return Math.round(Math.max(34, Math.min(54, 54 - Math.max(0, count - 7) * 0.24)));
}

/**
 * Lays the tree out: every bubble sits between its two sides. A bubble with only one side gets an empty spot on the other
 * (shown as a "+" in the editor), so branches never run into each other.
 */
export function layoutTree(root: Built): Laid {
  const r = bubbleRadius(countAll(root));
  const SLOT = r * 3.05, ROW = r * 3.3, PAD = r * 1.5;
  const placed: Placed[] = [];
  const phantoms: Phantom[] = [];
  let maxDepth = 0;
  function place(b: Built, depth: number, start: number, parentKey: string | null, side: Side | null): { x: number; next: number } {
    maxDepth = Math.max(maxDepth, depth);
    const key = b.node?.id ?? "root";
    const hasKids = b.lefts.length > 0 || b.rights.length > 0 || b.node === null;
    if (!hasKids) {
      placed.push({ key, node: b.node, x: start + 0.5, y: depth * ROW, parentKey, side, lopsided: false, left: 0, right: 0 });
      return { x: start + 0.5, next: start + 1 };
    }
    let cursor = start;
    const xs: number[] = [];
    /* each side holds its accounts side by side, or one empty spot (a "+") when it has none */
    const group = (list: Built[], s: Side) => {
      if (list.length) {
        for (const c of list) { const r = place(c, depth + 1, cursor, key, s); xs.push(r.x); cursor = r.next; }
      } else {
        phantoms.push({ key: `${key}:${s}`, x: cursor + 0.5, y: (depth + 1) * ROW, parentKey: key, parentId: b.node?.id ?? null, side: s });
        maxDepth = Math.max(maxDepth, depth + 1);
        xs.push(cursor + 0.5); cursor += 1;
      }
    };
    group(b.lefts, "left");
    group(b.rights, "right");
    const left = countSide(b.lefts), right = countSide(b.rights);
    const x = (xs[0] + xs[xs.length - 1]) / 2;
    placed.push({ key, node: b.node, x, y: depth * ROW, parentKey, side, lopsided: b.node ? left + right >= 3 && isLopsided(left, right) : false, left, right });
    return { x, next: cursor };
  }
  const end = place(root, 0, 0, null, null);
  const slots = Math.max(1, end.next);
  for (const p of placed) { p.x = p.x * SLOT + PAD; p.y += PAD; }
  for (const p of phantoms) { p.x = p.x * SLOT + PAD; p.y += PAD; }
  return { placed, phantoms, width: slots * SLOT + PAD * 2, height: maxDepth * ROW + PAD * 2 + 40, heavyRoot: balanceOf(root).heavy, r, row: ROW };
}

