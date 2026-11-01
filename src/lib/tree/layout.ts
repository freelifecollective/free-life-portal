export type TreeNode = { id: string; parent_id: string | null; side: "left" | "right"; label: string; rank: string | null; linked_member_id?: string | null; owned?: boolean };
export type Side = "left" | "right";

/** One account with everything under it. Its accounts sit side by side in the order they were placed (the owner at the very top has no node). */
export type Built = { node: TreeNode | null; kids: Built[] };

export function buildTree(nodes: TreeNode[]): Built {
  const by = new Map<string, Built>();
  for (const n of nodes) by.set(n.id, { node: n, kids: [] });
  const root: Built = { node: null, kids: [] };
  for (const n of nodes) {
    const b = by.get(n.id)!;
    const parent = n.parent_id ? by.get(n.parent_id) : root;
    if (parent) parent.kids.push(b);
  }
  return root;
}

/** How many bubbles are in this branch, counting itself (the owner at the very top does not count). */
export function countAll(b: Built | null): number {
  if (!b) return 0;
  return (b.node ? 1 : 0) + b.kids.reduce((n, c) => n + countAll(c), 0);
}

/** Lopsided: one side has at least two more accounts and at least one and a half times as many as the other. */
export function isLopsided(left: number, right: number): boolean {
  const hi = Math.max(left, right), lo = Math.min(left, right);
  return hi - lo >= 2 && hi >= 1.5 * lo;
}

export type Balance = { left: number; right: number; lopsided: boolean; heavy: Side | null };
/** The left and right sides of the top bubble, as they look on the screen: accounts drawn to its left are the left side, to its right the right side. */
export function balanceOf(b: Built): Balance {
  const l = layoutTree(b).placed.find((p) => p.key === "root");
  const left = l?.left ?? 0, right = l?.right ?? 0;
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
 * Lays the tree out: an account's accounts sit side by side in order, and it sits in the middle of the first and the last.
 * "Left" and "right" are worked out from where things end up on the screen: an account drawn to the left of its parent is on its
 * left side, to the right on its right side, and one directly underneath joins whichever side has fewer.
 */
export function layoutTree(root: Built): Laid {
  const r = bubbleRadius(countAll(root));
  const SLOT = r * 3.05, ROW = r * 3.3, PAD = r * 1.5;
  const placed: Placed[] = [];
  const phantoms: Phantom[] = [];
  let maxDepth = 0;
  const sizeOf = new Map<string, number>();
  const measure = (b: Built): number => { const n = countAll(b); sizeOf.set(b.node?.id ?? "root", n); for (const c of b.kids) measure(c); return n; };
  measure(root);
  function place(b: Built, depth: number, start: number, parentKey: string | null): { x: number; next: number } {
    maxDepth = Math.max(maxDepth, depth);
    const key = b.node?.id ?? "root";
    if (b.kids.length === 0) {
      placed.push({ key, node: b.node, x: start + 0.5, y: depth * ROW, parentKey, side: null, lopsided: false, left: 0, right: 0 });
      return { x: start + 0.5, next: start + 1 };
    }
    let cursor = start;
    const xs: number[] = [];
    for (const c of b.kids) { const res = place(c, depth + 1, cursor, key); xs.push(res.x); cursor = res.next; }
    const x = (xs[0] + xs[xs.length - 1]) / 2;
    placed.push({ key, node: b.node, x, y: depth * ROW, parentKey, side: null, lopsided: false, left: 0, right: 0 });
    return { x, next: cursor };
  }
  const end = place(root, 0, 0, null);
  const slots = Math.max(1, end.next);
  for (const p of placed) { p.x = p.x * SLOT + PAD; p.y += PAD; }
  /* which side each account is on, and how many accounts each side holds, from where they ended up */
  const by = new Map(placed.map((p) => [p.key, p]));
  const kidsOf = new Map<string, Placed[]>();
  for (const p of placed) if (p.parentKey) kidsOf.set(p.parentKey, [...(kidsOf.get(p.parentKey) ?? []), p]);
  for (const [parentKey, kids] of kidsOf) {
    const par = by.get(parentKey)!;
    let left = 0, right = 0;
    const middle: Placed[] = [];
    for (const k of kids) {
      const n = sizeOf.get(k.key) ?? 1;
      if (k.x < par.x - 1) { k.side = "left"; left += n; } else if (k.x > par.x + 1) { k.side = "right"; right += n; } else middle.push(k);
    }
    for (const k of middle) { const n = sizeOf.get(k.key) ?? 1; if (left <= right) { k.side = "left"; left += n; } else { k.side = "right"; right += n; } }
    par.left = left; par.right = right;
    par.lopsided = !!par.node && left + right >= 3 && isLopsided(left, right);
  }
  const rootP = by.get("root");
  const heavy: Side | null = rootP && isLopsided(rootP.left, rootP.right) ? (rootP.left > rootP.right ? "left" : "right") : null;
  return { placed, phantoms, width: slots * SLOT + PAD * 2, height: maxDepth * ROW + PAD * 2 + 40, heavyRoot: heavy, r, row: ROW };
}
