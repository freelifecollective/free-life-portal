import { describe, expect, it } from "vitest";
import { balanceOf, bubbleRadius, buildTree, countAll, isLopsided, layoutTree, type TreeNode } from "../layout";
import { swatchOf } from "../colors";

const n = (id: string, parent: string | null, side: "left" | "right", label = id): TreeNode => ({ id, parent_id: parent, side, label, rank: null });

describe("family tree", () => {
  const nodes = [n("a", null, "left"), n("b", null, "right"), n("c", "a", "left"), n("d", "a", "right"), n("e", "c", "left")];
  it("counts every account under each side", () => {
    const root = buildTree(nodes);
    expect(countAll(root)).toBe(5);
    expect(balanceOf(root)).toMatchObject({ left: 4, right: 1, lopsided: true, heavy: "left" });
  });
  it("decides when a tree is lopsided", () => {
    expect(isLopsided(0, 0)).toBe(false);
    expect(isLopsided(3, 2)).toBe(false);
    expect(isLopsided(4, 3)).toBe(false);
    expect(isLopsided(2, 0)).toBe(true);
    expect(isLopsided(6, 3)).toBe(true);
    expect(isLopsided(1, 0)).toBe(false);
  });
  it("lays bubbles out without overlap", () => {
    const l = layoutTree(buildTree(nodes));
    expect(l.placed).toHaveLength(6);
    for (const p of l.placed) for (const q of l.placed) if (p !== q && p.y === q.y) expect(Math.abs(p.x - q.x)).toBeGreaterThanOrEqual(2 * l.r + 4);
    const by = new Map(l.placed.map((p) => [p.node?.id ?? "root", p]));
    expect(by.get("a")!.x).toBeLessThan(by.get("b")!.x);
    expect(by.get("c")!.x).toBeLessThan(by.get("d")!.x);
    expect(by.get("root")!.y).toBeLessThan(by.get("a")!.y);
  });
  it("a bubble with one side only sits straight above its account (no empty spot is reserved)", () => {
    const l = layoutTree(buildTree([n("a", null, "left")]));
    expect(l.phantoms).toHaveLength(0);
    expect(l.placed.find((p) => p.node?.id === "a")!.x).toBeCloseTo(l.placed.find((p) => p.key === "root")!.x, 5);
  });
  it("flags a lopsided branch", () => {
    const l = layoutTree(buildTree([n("a", null, "left"), n("c", "a", "left"), n("e", "c", "left"), n("f", "e", "left")]));
    expect(l.placed.find((p) => p.node?.id === "a")!.lopsided).toBe(true);
  });
  it("an empty tree is just the top bubble", () => {
    const l = layoutTree(buildTree([]));
    expect(l.placed).toHaveLength(1);
    expect(l.phantoms).toHaveLength(0);
  });
  it("bubbles shrink slowly as the tree grows", () => {
    expect(bubbleRadius(0)).toBe(54);
    expect(bubbleRadius(7)).toBe(54);
    expect(bubbleRadius(30)).toBeLessThan(54);
    expect(bubbleRadius(30)).toBeGreaterThan(40);
    expect(bubbleRadius(500)).toBe(34);
  });
  it("colours bubbles by rank, with the owner's own accounts in one colour", () => {
    const c = (rank: string | null, owned = false) => swatchOf({ rank, owned }).key;
    expect([c("1A"), c("2A"), c("3A")]).toEqual(["1-3", "1-3", "1-3"]);
    expect([c("4A"), c("5A")]).toEqual(["4-5", "4-5"]);
    expect(c("6A")).toBe("6");
    expect(c("6A2")).toBe("62");
    expect(c("6A2-2")).toBe("62-2");
    expect(c("6A2-3+")).toBe("62-3");
    for (const r of ["6A2-3", "6A2-4", "6A2-5", "6A2-6", "6A2-7", "6A2-8"]) expect(c(r)).toBe("62-3");
    expect(c(null)).toBe("none");
    expect(c("6A2", true)).toBe("owned");
  });
  it("lets a side hold more than one account", () => {
    const many = [n("a", null, "left"), n("b", null, "left"), n("c", null, "left"), n("d", null, "right"), n("e", "a", "left"), n("f", "a", "left"), n("g", "a", "right")];
    const root = buildTree(many);
    expect(countAll(root)).toBe(7);
    const bal = balanceOf(root);
    expect(bal.left + bal.right).toBe(7);
    expect(bal.left).toBeGreaterThan(0);
    expect(bal.right).toBeGreaterThan(0);
    const l = layoutTree(root);
    expect(l.placed).toHaveLength(8);
    for (const p of l.placed) for (const q of l.placed) if (p !== q && p.y === q.y) expect(Math.abs(p.x - q.x)).toBeGreaterThanOrEqual(2 * l.r + 4);
    const by = new Map(l.placed.map((p) => [p.node?.id ?? "root", p]));
    expect(by.get("a")!.x).toBeLessThan(by.get("b")!.x);
    expect(by.get("b")!.x).toBeLessThan(by.get("c")!.x);
    expect(by.get("c")!.x).toBeLessThan(by.get("d")!.x);
    expect(by.get("e")!.y).toBeGreaterThan(by.get("a")!.y);
    /* the parent sits in the middle of its first and last account */
    expect(by.get("a")!.x).toBeCloseTo((by.get("e")!.x + by.get("g")!.x) / 2, 5);
  });
  it("counts left and right the way it looks on the screen, whatever the stored side says", () => {
    /* all three were stored as "left" (for example after dragging them around), but they sit across the page */
    const root = buildTree([n("a", null, "left"), n("b", null, "left"), n("c", null, "left"), n("d", "c", "left")]);
    const bal = balanceOf(root);
    expect(bal).toMatchObject({ left: 2, right: 2, lopsided: false });
    const l = layoutTree(root);
    const rootX = l.placed.find((p) => p.key === "root")!.x;
    expect(l.placed.find((p) => p.key === "a")!.x).toBeLessThan(rootX);
    expect(l.placed.find((p) => p.key === "c")!.x).toBeGreaterThan(rootX);
  });
  it("an account moved to the far side is counted there", () => {
    const root = buildTree([n("a", null, "left"), n("b", null, "right"), n("c", null, "right"), n("d", null, "right")]);
    const bal = balanceOf(root);
    expect(bal.left + bal.right).toBe(4);
    expect(Math.abs(bal.left - bal.right)).toBeLessThanOrEqual(2);
  });
});
