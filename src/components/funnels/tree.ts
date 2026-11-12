import { newElement, newId, newRow, newSection, type Column, type El, type ElementType, type Page, type Row, type Section } from "@/lib/funnels/types";

/* Small helpers for changing a page. Each one returns a new page and leaves the old one as it was (for undo). */

export type Kind = "section" | "row" | "column" | "element";
export type Sel = { kind: Kind; id: string } | null;
export type Found =
  | { kind: "section"; item: Section; si: number }
  | { kind: "row"; item: Row; si: number; ri: number }
  | { kind: "column"; item: Column; si: number; ri: number; ci: number }
  | { kind: "element"; item: El; si: number; ri: number; ci: number; ei: number };

export const clone = (p: Page): Page => JSON.parse(JSON.stringify(p)) as Page;

export function find(page: Page, id: string): Found | null {
  for (let si = 0; si < page.sections.length; si++) {
    const s = page.sections[si];
    if (s.id === id) return { kind: "section", item: s, si };
    for (let ri = 0; ri < s.rows.length; ri++) {
      const r = s.rows[ri];
      if (r.id === id) return { kind: "row", item: r, si, ri };
      for (let ci = 0; ci < r.columns.length; ci++) {
        const c = r.columns[ci];
        if (c.id === id) return { kind: "column", item: c, si, ri, ci };
        for (let ei = 0; ei < c.elements.length; ei++) if (c.elements[ei].id === id) return { kind: "element", item: c.elements[ei], si, ri, ci, ei };
      }
    }
  }
  return null;
}

/** The list a piece sits in, so it can be moved, copied or removed. */
function listOf(page: Page, f: Found): { list: unknown[]; i: number } {
  if (f.kind === "section") return { list: page.sections, i: f.si };
  if (f.kind === "row") return { list: page.sections[f.si].rows, i: f.ri };
  if (f.kind === "column") return { list: page.sections[f.si].rows[f.ri].columns, i: f.ci };
  return { list: page.sections[f.si].rows[f.ri].columns[f.ci].elements, i: f.ei };
}

/** Change one piece in place (on a copy of the page). */
export function update(page: Page, id: string, change: (item: Section | Row | Column | El) => void): Page {
  const p = clone(page);
  const f = find(p, id);
  if (f) change(f.item);
  return p;
}

export function move(page: Page, id: string, dir: -1 | 1): Page {
  const p = clone(page);
  const f = find(p, id);
  if (!f) return page;
  const { list, i } = listOf(p, f);
  const j = i + dir;
  if (j < 0 || j >= list.length) return page;
  [list[i], list[j]] = [list[j], list[i]];
  return p;
}

/** A copy with fresh ids everywhere inside it. */
function fresh<T>(x: T): T {
  const c = JSON.parse(JSON.stringify(x)) as Record<string, unknown>;
  const walk = (o: Record<string, unknown>) => {
    if (typeof o.id === "string") o.id = newId();
    for (const k of ["rows", "columns", "elements"]) if (Array.isArray(o[k])) (o[k] as Record<string, unknown>[]).forEach(walk);
  };
  walk(c);
  return c as T;
}

export function duplicate(page: Page, id: string): { page: Page; id: string | null } {
  const p = clone(page);
  const f = find(p, id);
  if (!f) return { page, id: null };
  const { list, i } = listOf(p, f);
  const copy = fresh(list[i] as { id: string });
  list.splice(i + 1, 0, copy);
  return { page: p, id: copy.id };
}

export function remove(page: Page, id: string): Page {
  const p = clone(page);
  const f = find(p, id);
  if (!f) return page;
  const { list, i } = listOf(p, f);
  /* a row keeps at least one column */
  if (f.kind === "column" && list.length <= 1) return page;
  list.splice(i, 1);
  return p;
}

/** Where a new element goes: after the chosen element, at the end of the chosen column or row, or at the very end of the page. */
export function addElement(page: Page, type: ElementType, sel: Sel): { page: Page; id: string } {
  const p = clone(page);
  const el = newElement(type);
  const f = sel ? find(p, sel.id) : null;
  if (f?.kind === "element") p.sections[f.si].rows[f.ri].columns[f.ci].elements.splice(f.ei + 1, 0, el);
  else if (f?.kind === "column") f.item.elements.push(el);
  else if (f?.kind === "row") f.item.columns[0].elements.push(el);
  else if (f?.kind === "section") {
    if (!f.item.rows.length) f.item.rows.push(newRow(1));
    f.item.rows[f.item.rows.length - 1].columns[0].elements.push(el);
  } else {
    if (!p.sections.length) p.sections.push(newSection());
    const last = p.sections[p.sections.length - 1];
    if (!last.rows.length) last.rows.push(newRow(1));
    last.rows[last.rows.length - 1].columns[0].elements.push(el);
  }
  return { page: p, id: el.id };
}

export function addSection(page: Page, sel: Sel): { page: Page; id: string } {
  const p = clone(page);
  const s = newSection();
  const f = sel ? find(p, sel.id) : null;
  p.sections.splice(f ? f.si + 1 : p.sections.length, 0, s);
  return { page: p, id: s.id };
}

export function addRow(page: Page, columns: number, sel: Sel): { page: Page; id: string } {
  const p = clone(page);
  const r = newRow(columns);
  const f = sel ? find(p, sel.id) : null;
  if (f && f.kind !== "section") p.sections[f.si].rows.splice(f.ri + 1, 0, r);
  else if (f) f.item.rows.push(r);
  else {
    if (!p.sections.length) p.sections.push({ ...newSection(), rows: [] });
    p.sections[p.sections.length - 1].rows.push(r);
  }
  return { page: p, id: r.id };
}

/** Change how many columns a row has, keeping its elements (extra columns' elements move into the last one kept). */
export function setColumns(page: Page, rowId: string, n: number): Page {
  return update(page, rowId, (item) => {
    const r = item as Row;
    while (r.columns.length < n) r.columns.push({ id: newId(), style: {}, elements: [] });
    while (r.columns.length > n) { const gone = r.columns.pop()!; r.columns[r.columns.length - 1].elements.push(...gone.elements); }
  });
}

/** Drag and drop: move an element into a column, before the element at `index` (or at the end). */
export function dropElement(page: Page, elId: string, colId: string, index: number | null): Page {
  const p = clone(page);
  const from = find(p, elId);
  const to = find(p, colId);
  if (!from || from.kind !== "element" || !to || to.kind !== "column") return page;
  const src = p.sections[from.si].rows[from.ri].columns[from.ci].elements;
  const [el] = src.splice(from.ei, 1);
  const dest = (find(p, colId)!.item as Column).elements;
  let at = index ?? dest.length;
  if (src === dest && from.ei < at) at -= 1;
  dest.splice(Math.max(0, Math.min(at, dest.length)), 0, el);
  return p;
}
