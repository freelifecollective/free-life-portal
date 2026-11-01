"use client";

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { LEGEND, OWNED, swatchOf } from "@/lib/tree/colors";
import { buildTree, layoutTree, type Side, type TreeNode } from "@/lib/tree/layout";
import type { KeyPos } from "./useKeyPos";

/** Where among the others on a side: first, right after one of them, or (nothing given) at the end. */
export type Place = { first?: boolean; after?: string };

const AMBER = "#D9962B";

/** Splits a name over up to two lines that fit inside a bubble of this size. */
function lines(label: string, max: number): string[] {
  const words = label.trim().split(/\s+/);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= max) cur += " " + w;
    else { out.push(cur); cur = w; }
  }
  if (cur) out.push(cur);
  const fit = out.slice(0, 2).map((s) => (s.length > max ? s.slice(0, max - 1) + "…" : s));
  if (out.length > 2) fit[1] = fit[1].replace(/…?$/, "…");
  return fit;
}

/** The organization chart. You are the top box; every box has a left and a right side, and its colour tells the rank (or that it is one of your own accounts). */
export const TreeChart = forwardRef<SVGSVGElement, {
  nodes: TreeNode[]; ownerName: string; ownerRank?: string | null; keyPos?: KeyPos; availW?: number; leftLabel: string; rightLabel: string;
  onPick?: (id: string) => void; onPickRoot?: () => void; onAdd?: (parentId: string | null, side: Side) => void;
  /** Drag an account (and everything under it) onto another account, the top box, or a "+" spot. */
  onMove?: (id: string, parentId: string | null, side: Side, place?: Place) => void;
  /** Right-click a bubble. */
  onMenu?: (id: string, x: number, y: number) => void;
}>(function TreeChart({ nodes, ownerName, ownerRank, keyPos = "left", availW = 0, leftLabel, rightLabel, onPick, onPickRoot, onAdd, onMove, onMenu }, ref) {
  const laid = useMemo(() => layoutTree(buildTree(nodes)), [nodes]);
  const R = laid.r;
  const pos = new Map(laid.placed.map((p) => [p.key, p]));
  /* which of the owner's two sides a bubble belongs to, so the heavier side can be marked */
  const legOf = (key: string): Side | null => {
    let p = pos.get(key);
    while (p && p.parentKey && p.parentKey !== "root") p = pos.get(p.parentKey);
    return p && p.parentKey === "root" ? p.side : null;
  };
  const editable = !!onPick;
  const gRef = useRef<SVGGElement>(null);
  type Hit = { parentId: string | null; side: Side; x: number; y: number; w: number; h: number; place?: Place; line?: boolean; from?: { x: number; y: number } };
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; over: Hit | null } | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  const justDragged = useRef(false);
  useEffect(() => () => cleanup.current?.(), []);
  /* the colour key: a column down the left or right, or one line along the top or bottom */
  const itemW = (label: string) => 26 + label.length * 5.8;
  const keyItems = LEGEND.map((sw) => ({ sw, label: sw === OWNED ? "My accounts" : sw.label }));
  const gap = 12;
  const rowW = keyItems.reduce((n, k) => n + itemW(k.label), 0) + (keyItems.length - 1) * gap;
  const colW = Math.max(...keyItems.map((k) => itemW(k.label))) + 8;
  const colH = keyItems.length * 22;
  const vertical = keyPos === "left" || keyPos === "right";
  const chartH = laid.height - R * 0.6;
  const sideW = vertical ? colW + 28 : 0, bandH = vertical ? 0 : 38;
  const W = Math.max(laid.width + sideW, (vertical ? 0 : rowW + 40), 460, availW);
  const H = Math.max(chartH + bandH, vertical ? colH + 32 : 0, 460);
  const shift = (W - sideW - laid.width) / 2 + (keyPos === "left" ? sideW : 0);
  const chartY = keyPos === "top" ? bandH : 0;
  /* the key hugs its edge of the white space and its colours are spread out to fill it */
  const n = keyItems.length;
  const vgap = vertical ? Math.min(84, Math.max(22, (H - 80) / (n - 1))) : 22;
  const hgap = vertical ? gap : Math.max(gap, (W - 56 - keyItems.reduce((t, k) => t + itemW(k.label), 0)) / (n - 1));
  const keyX = keyPos === "left" ? 18 : keyPos === "right" ? W - colW - 18 : 28;
  const keyY = keyPos === "bottom" ? chartH + 10 : keyPos === "top" ? 12 : 44;
  const bw = R * 2.7, bh = R * 1.5;
  /* everything inside a dragged account moves with it, so none of it can be a place to drop */
  const below = (id: string) => {
    const out = new Set<string>([id]);
    for (const p of laid.placed) { let q: typeof p | undefined = p; while (q) { if (q.key === id) { out.add(p.key); break; } q = q.parentKey ? pos.get(q.parentKey) : undefined; } }
    return out;
  };
  const hitAt = (x: number, y: number, skip: Set<string>, draggedId = ""): Hit | null => {
    const slack = 6;
    for (const p of laid.placed) {
      if (skip.has(p.key)) continue;
      if (x >= p.x - bw / 2 - slack && x <= p.x + bw / 2 + slack && y >= p.y - bh / 2 - slack && y <= p.y + bh / 2 + slack) {
        const left = x < p.x;
        return { parentId: p.node?.id ?? null, side: left ? "left" : "right", x: p.x - bw / 2, y: p.y - bh / 2, w: bw, h: bh, place: left ? { first: true } : undefined };
      }
    }
    const pw = bw * 0.62, phh = bh * 0.8;
    for (const ph of laid.phantoms) {
      if (skip.has(ph.parentKey)) continue;
      if (x >= ph.x - pw / 2 - slack && x <= ph.x + pw / 2 + slack && y >= ph.y - phh / 2 - slack && y <= ph.y + phh / 2 + slack) return { parentId: ph.parentId, side: ph.side, x: ph.x - pw / 2, y: ph.y - phh / 2, w: pw, h: phh };
    }
    /* empty white space, anywhere on the chart: the account whose natural spot for a new branch is closest becomes the parent,
       and the new bubble goes right where it is dropped (a faded line shows where it will hang from) */
    if (x + shift < 0 || x + shift > W || y + chartY < 0 || y + chartY > H) return null;
    let parent: (typeof laid.placed)[number] | null = null;
    let bestCost = Infinity;
    for (const p of laid.placed) {
      if (skip.has(p.key)) continue;
      if (y < p.y + bh) continue;   /* the new bubble must sit below its parent */
      const cost = Math.hypot(x - p.x, y - p.y - laid.row);
      if (cost < bestCost) { bestCost = cost; parent = p; }
    }
    if (!parent) parent = pos.get("root") ?? null;
    if (!parent) return null;
    const side: Side = x < parent.x ? "left" : "right";
    const sibs = laid.placed.filter((p) => p.parentKey === parent!.key && p.key !== draggedId).sort((a, c) => a.x - c.x);
    const before = sibs.filter((p) => p.x < x);
    const place: Place | undefined = sibs.length === 0 ? undefined : before.length === 0 ? { first: true } : before.length === sibs.length ? undefined : { after: before[before.length - 1].key };
    return { parentId: parent.node?.id ?? null, side, x: x - bw / 2, y: y - bh / 2, w: bw, h: bh, place, line: true, from: { x: parent.x, y: parent.y + bh / 2 } };
  };
  /** Press on an account: a mouse starts dragging after a few pixels, a finger after a short hold (so scrolling still works). */
  const startDrag = (e: React.PointerEvent, id: string) => {
    if (!onMove || e.button > 0 || !gRef.current) return;
    const g = gRef.current;
    const toLocal = (cx: number, cy: number) => { const m = g.getScreenCTM(); if (!m) return { x: 0, y: 0 }; const pt = new DOMPoint(cx, cy).matrixTransform(m.inverse()); return { x: pt.x, y: pt.y }; };
    const skip = below(id);
    const sx = e.clientX, sy = e.clientY, touch = e.pointerType === "touch";
    let active = false, dead = false;
    const begin = (cx: number, cy: number) => { active = true; const l = toLocal(cx, cy); setDrag({ id, x: l.x, y: l.y, over: hitAt(l.x, l.y, skip, id) }); };
    const timer = touch ? window.setTimeout(() => { if (!dead) begin(sx, sy); }, 350) : undefined;
    const move = (ev: PointerEvent) => {
      const moved = Math.hypot(ev.clientX - sx, ev.clientY - sy);
      if (!active) {
        if (touch) { if (moved > 8) { dead = true; end(false); } return; }   /* a finger that moves first is scrolling */
        if (moved < 6) return;
        begin(ev.clientX, ev.clientY);
      }
      ev.preventDefault();
      const l = toLocal(ev.clientX, ev.clientY);
      setDrag({ id, x: l.x, y: l.y, over: hitAt(l.x, l.y, skip, id) });
    };
    const block = (ev: TouchEvent) => { if (active) ev.preventDefault(); };
    const up = (ev: PointerEvent) => {
      if (active) {
        const l = toLocal(ev.clientX, ev.clientY);
        const hit = hitAt(l.x, l.y, skip, id);
        justDragged.current = true; window.setTimeout(() => { justDragged.current = false; }, 80);
        end(true, hit);
      } else end(false);
    };
    const end = (finish: boolean, hit?: Hit | null) => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("touchmove", block);
      cleanup.current = null;
      setDrag(null);
      if (finish && hit) onMove(id, hit.parentId, hit.side, hit.place);
    };
    const cancel = () => end(false);
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", cancel);
    window.addEventListener("touchmove", block, { passive: false });
    cleanup.current = () => end(false);
  };
  const fs = Math.max(11, R * 0.3), maxChars = Math.max(9, Math.round(bw / (fs * 0.62)));
  const key = (e: React.KeyboardEvent, fn: () => void) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } };
  /* straight lines with square corners: down from the parent, across, down into the child */
  const elbow = (px: number, py: number, cx: number, cy: number) => { const midY = py + (cy - py) / 2; return `M ${px} ${py} V ${midY} H ${cx} V ${cy}`; };
  return (
    <svg ref={ref} width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ownerName} className="ft-svg">
      <g aria-hidden="true" transform={`translate(${keyX}, ${keyY})`}>
        {keyItems.map((k, i) => {
          const x = vertical ? 0 : keyItems.slice(0, i).reduce((t, m) => t + itemW(m.label) + hgap, 0);
          const y = vertical ? i * vgap : 0;
          return (
            <g key={k.sw.key} transform={`translate(${x}, ${y})`}>
              <rect x={0} y={0} width={16} height={12} rx={3} fill={k.sw.fill} stroke={k.sw.stroke} strokeWidth={1.5} />
              <text x={22} y={10} fontSize={11} fill="#5b514a">{k.label}</text>
            </g>
          );
        })}
      </g>
      <g ref={gRef} transform={`translate(${shift}, ${chartY})`}>
        {laid.placed.filter((p) => p.parentKey).map((p) => {
          const par = pos.get(p.parentKey!)!;
          const hot = laid.heavyRoot !== null && legOf(p.key) === laid.heavyRoot;
          return <path key={"l" + p.key} d={elbow(par.x, par.y + bh / 2, p.x, p.y - bh / 2)} fill="none" stroke={hot ? AMBER : "#C9B8A8"} strokeWidth={hot ? 3 : 2} strokeLinejoin="miter" />;
        })}
        {laid.phantoms.map((ph) => {
          const par = pos.get(ph.parentKey)!;
          const pw = bw * 0.62, phh = bh * 0.8;
          return (
            <g key={"p" + ph.key}>
              <path d={elbow(par.x, par.y + bh / 2, ph.x, ph.y - phh / 2)} fill="none" stroke="#E4DBD2" strokeWidth={2} strokeDasharray="5 5" />
              {editable ? (
                <g role="button" tabIndex={0} aria-label={ph.side === "left" ? leftLabel : rightLabel} style={{ cursor: "pointer" }}
                  onClick={() => onAdd?.(ph.parentId, ph.side)} onKeyDown={(e) => key(e, () => onAdd?.(ph.parentId, ph.side))}>
                  <rect x={ph.x - pw / 2} y={ph.y - phh / 2} width={pw} height={phh} rx={8} fill="#fff" stroke="#B9A797" strokeWidth={2} strokeDasharray="5 4" />
                  <text x={ph.x} y={ph.y + fs * 0.75} textAnchor="middle" fontSize={fs * 2} fill="#9a8878">+</text>
                  <text x={ph.x} y={ph.y + phh / 2 + 16} textAnchor="middle" fontSize={11} fill="#9a8878">{ph.side === "left" ? leftLabel : rightLabel}</text>
                </g>
              ) : null}
            </g>
          );
        })}
        {laid.placed.map((p) => {
          const isRoot = p.key === "root";
          const hot = !isRoot && laid.heavyRoot !== null && legOf(p.key) === laid.heavyRoot;
          const sw = isRoot ? OWNED : swatchOf(p.node!);
          const dark = isRoot || sw === OWNED;
          const text = lines(isRoot ? ownerName : p.node!.label, maxChars);
          const rank = isRoot ? ownerRank : p.node!.rank;
          /* the name lines and the rank are centred as one block, so the text sits in the middle of the box however much there is */
          const lh = fs * 1.2, rankGap = rank ? fs * 0.35 : 0, rankH = rank ? fs * 1.1 : 0;
          const blockH = text.length * lh + rankGap + rankH;
          const top = p.y - blockH / 2;
          const lineY = (i: number) => top + i * lh + lh * 0.78;
          const rankY = top + text.length * lh + rankGap + rankH * 0.78;
          const click0 = isRoot ? onPickRoot : onPick ? () => onPick(p.node!.id) : undefined;
          const click = click0 ? () => { if (!justDragged.current) click0(); } : undefined;
          const dim = drag ? below(drag.id).has(p.key) : false;
          const x0 = p.x - bw / 2, y0 = p.y - bh / 2;
          return (
            <g key={p.key} className={click ? "ft-bubble" : undefined} role={click ? "button" : undefined} tabIndex={click ? 0 : undefined}
              aria-label={isRoot ? ownerName : p.node!.label} style={click ? { cursor: onMove && !isRoot ? "grab" : "pointer", opacity: dim ? 0.3 : 1 } : undefined}
              onPointerDown={!isRoot && onMove ? (e) => startDrag(e, p.node!.id) : undefined}
              onContextMenu={onMenu ? (e) => { e.preventDefault(); onMenu(isRoot ? "root" : p.node!.id, e.clientX, e.clientY); } : undefined}
              onClick={click} onKeyDown={click ? (e) => key(e, click) : undefined}>
              <title>{isRoot ? ownerName : p.lopsided ? `${p.node!.label} (${p.left} · ${p.right})` : p.node!.label}</title>
              {p.lopsided ? <rect x={x0 - 7} y={y0 - 7} width={bw + 14} height={bh + 14} rx={12} fill="none" stroke={AMBER} strokeWidth={3} strokeDasharray="4 4" /> : null}
              {hot ? <rect x={x0 - 4} y={y0 - 4} width={bw + 8} height={bh + 8} rx={11} fill="none" stroke={AMBER} strokeWidth={2} /> : null}
              <rect className="ft-box" x={x0} y={y0} width={bw} height={bh} rx={8} fill={sw.fill} stroke={sw.stroke} strokeWidth={2} />
              {text.map((t, i) => <text key={i} x={p.x} y={lineY(i)} textAnchor="middle" fontSize={fs} fontWeight={400} fill={dark ? "#fff" : "#2B2522"}>{t}</text>)}
              {rank ? <text x={p.x} y={rankY} textAnchor="middle" fontSize={fs * 0.92} fontWeight={400} fill={dark ? "#fff" : sw.stroke}>{rank}</text> : null}
              {!isRoot && p.node!.linked_member_id ? <circle cx={x0 + bw - 6} cy={y0 + 6} r={5} fill="#5E9C76" stroke="#fff" strokeWidth={1.5} /> : null}
            </g>
          );
        })}
        {drag ? (() => {
          const src = pos.get(drag.id);
          if (!src?.node) return null;
          const sw = swatchOf(src.node);
          const dark = sw === OWNED;
          const over = drag.over;
          return (
            <g pointerEvents="none">
              {over ? (
                <g>
                  {over.line && over.from ? (
                    <path d={`M ${over.from.x} ${over.from.y} V ${over.from.y + (over.y - over.from.y) / 2} H ${over.x + over.w / 2} V ${over.y}`} fill="none" stroke="#AB9080" strokeOpacity={0.55} strokeWidth={3} strokeDasharray="7 5" />
                  ) : <rect x={over.x - 4} y={over.y - 4} width={over.w + 8} height={over.h + 8} rx={11} fill="rgba(171,144,128,.15)" stroke="#AB9080" strokeWidth={3} />}
                  <text x={over.x + over.w / 2} y={over.y + over.h + 20} textAnchor="middle" fontSize={12} fontWeight={700} fill="#8D7364">{over.line ? "New branch here" : over.side === "left" ? "Drop to the left" : "Drop to the right"}</text>
                </g>
              ) : null}
              <g opacity={0.92} transform={`translate(${drag.x - bw / 2}, ${drag.y - bh / 2})`}>
                <rect width={bw} height={bh} rx={8} fill={sw.fill} stroke={sw.stroke} strokeWidth={2} />
                <text x={bw / 2} y={bh / 2 + fs * 0.35} textAnchor="middle" fontSize={fs} fill={dark ? "#fff" : "#2B2522"}>{lines(src.node.label, maxChars)[0]}</text>
              </g>
            </g>
          );
        })() : null}
      </g>
    </svg>
  );
});
