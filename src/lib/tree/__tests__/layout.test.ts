import { describe, expect, it } from "vitest";
import { balanceOf, buildTree, countAll, isLopsided, layoutTree, type TreeNode } from "../layout";

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
    for (const p of l.placed) for (const q of l.placed) if (p !== q && p.y === q.y) expect(Math.abs(p.x - q.x)).toBeGreaterThanOrEqual(100);
    const by = new Map(l.placed.map((p) => [p.node?.id ?? "root", p]));
    expect(by.get("a")!.x).toBeLessThan(by.get("b")!.x);
    expect(by.get("c")!.x).toBeLessThan(by.get("d")!.x);
    expect(by.get("root")!.y).toBeLessThan(by.get("a")!.y);
  });
  it("gives a bubble with one side an empty spot for the other", () => {
    const l = layoutTree(buildTree([n("a", null, "left")]));
    expect(l.phantoms.map((p) => p.side)).toEqual(["right"]);
    expect(l.phantoms[0].x).toBeGreaterThan(l.placed.find((p) => p.node?.id === "a")!.x);
  });
  it("flags a lopsided branch", () => {
    const l = layoutTree(buildTree([n("a", null, "left"), n("c", "a", "left"), n("e", "c", "left"), n("f", "e", "left")]));
    expect(l.placed.find((p) => p.node?.id === "a")!.lopsided).toBe(true);
  });
  it("an empty tree has two empty spots", () => {
    const l = layoutTree(buildTree([]));
    expect(l.placed).toHaveLength(1);
    expect(l.phantoms.map((p) => p.side).sort()).toEqual(["left", "right"]);
  });
});
