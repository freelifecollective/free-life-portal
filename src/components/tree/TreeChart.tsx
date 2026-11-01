"use client";

import { forwardRef, useMemo } from "react";
import { LEGEND, OWNED, swatchOf } from "@/lib/tree/colors";
import { buildTree, layoutTree, type Side, type TreeNode } from "@/lib/tree/layout";

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
  nodes: TreeNode[]; ownerName: string; ownerRank?: string | null; leftLabel: string; rightLabel: string;
  onPick?: (id: string) => void; onPickRoot?: () => void; onAdd?: (parentId: string | null, side: Side) => void;
}>(function TreeChart({ nodes, ownerName, ownerRank, leftLabel, rightLabel, onPick, onPickRoot, onAdd }, ref) {
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
  /* the colour key runs across the top on one line */
  const itemW = (label: string) => 34 + label.length * 6.6;
  const keyItems = LEGEND.map((sw) => ({ sw, label: sw === OWNED ? "My accounts" : sw.label }));
  const keyW = keyItems.reduce((n, k) => n + itemW(k.label), 0) + (keyItems.length - 1) * 14;
  const legendH = 46;
  const W = Math.max(laid.width, keyW + 48, 560), H = laid.height + legendH - R * 0.6;
  const shift = (W - laid.width) / 2;
  const bw = R * 2.7, bh = R * 1.5;
  const fs = Math.max(11, R * 0.3), maxChars = Math.max(9, Math.round(bw / (fs * 0.56)));
  const key = (e: React.KeyboardEvent, fn: () => void) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } };
  /* straight lines with square corners: down from the parent, across, down into the child */
  const elbow = (px: number, py: number, cx: number, cy: number) => { const midY = py + (cy - py) / 2; return `M ${px} ${py} V ${midY} H ${cx} V ${cy}`; };
  let kx = (W - keyW) / 2;
  return (
    <svg ref={ref} width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ownerName} className="ft-svg">
      <g aria-hidden="true" transform="translate(0, 14)">
        {keyItems.map((k) => {
          const x = kx; kx += itemW(k.label) + 14;
          return (
            <g key={k.sw.key} transform={`translate(${x}, 0)`}>
              <rect x={0} y={0} width={20} height={16} rx={4} fill={k.sw.fill} stroke={k.sw.stroke} strokeWidth={2} />
              <text x={28} y={13} fontSize={12} fill="#5b514a">{k.label}</text>
            </g>
          );
        })}
      </g>
      <g transform={`translate(${shift}, ${legendH - R * 0.6})`}>
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
          const startY = p.y - (rank ? fs * 0.5 : 0) - (text.length - 1) * (fs * 0.55);
          const click = isRoot ? onPickRoot : onPick ? () => onPick(p.node!.id) : undefined;
          const x0 = p.x - bw / 2, y0 = p.y - bh / 2;
          return (
            <g key={p.key} className={click ? "ft-bubble" : undefined} role={click ? "button" : undefined} tabIndex={click ? 0 : undefined}
              aria-label={isRoot ? ownerName : p.node!.label} style={click ? { cursor: "pointer" } : undefined}
              onClick={click} onKeyDown={click ? (e) => key(e, click) : undefined}>
              <title>{isRoot ? ownerName : p.lopsided ? `${p.node!.label} (${p.left} · ${p.right})` : p.node!.label}</title>
              {p.lopsided ? <rect x={x0 - 7} y={y0 - 7} width={bw + 14} height={bh + 14} rx={12} fill="none" stroke={AMBER} strokeWidth={3} strokeDasharray="4 4" /> : null}
              {hot ? <rect x={x0 - 4} y={y0 - 4} width={bw + 8} height={bh + 8} rx={11} fill="none" stroke={AMBER} strokeWidth={2} /> : null}
              <rect className="ft-box" x={x0} y={y0} width={bw} height={bh} rx={8} fill={sw.fill} stroke={sw.stroke} strokeWidth={2} />
              {text.map((t, i) => <text key={i} x={p.x} y={startY + i * fs * 1.1 + fs * 0.35} textAnchor="middle" fontSize={fs} fontWeight={600} fill={dark ? "#fff" : "#2B2522"}>{t}</text>)}
              {rank ? <text x={p.x} y={p.y + bh * 0.34} textAnchor="middle" fontSize={fs * 0.92} fontWeight={700} fill={dark ? "#fff" : sw.stroke}>{rank}</text> : null}
              {!isRoot && p.node!.linked_member_id ? <circle cx={x0 + bw - 6} cy={y0 + 6} r={5} fill="#5E9C76" stroke="#fff" strokeWidth={1.5} /> : null}
            </g>
          );
        })}
      </g>
    </svg>
  );
});
