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

/** The bubble chart. You are the top bubble; every bubble has a left and a right side, and its colour tells the rank (or that it is one of your own accounts). */
export const TreeChart = forwardRef<SVGSVGElement, {
  nodes: TreeNode[]; ownerName: string; ownerRank?: string | null; youLabel: string; leftLabel: string; rightLabel: string;
  onPick?: (id: string) => void; onPickRoot?: () => void; onAdd?: (parentId: string | null, side: Side) => void;
}>(function TreeChart({ nodes, ownerName, ownerRank, youLabel, leftLabel, rightLabel, onPick, onPickRoot, onAdd }, ref) {
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
  const legendH = 54;
  const W = Math.max(laid.width, 560), H = laid.height + legendH + 24;
  const shift = (W - laid.width) / 2;
  const fs = Math.max(10, R * 0.3), maxChars = Math.max(7, Math.round(R / 4.4));
  const key = (e: React.KeyboardEvent, fn: () => void) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } };
  return (
    <svg ref={ref} width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ownerName} className="ft-svg">
      <g transform={`translate(${shift}, 8)`}>
        {laid.placed.filter((p) => p.parentKey).map((p) => {
          const par = pos.get(p.parentKey!)!;
          const hot = laid.heavyRoot !== null && legOf(p.key) === laid.heavyRoot;
          const midY = (par.y + R + p.y - R) / 2;
          return <path key={"l" + p.key} d={`M ${par.x} ${par.y + R} C ${par.x} ${midY}, ${p.x} ${midY}, ${p.x} ${p.y - R}`} fill="none" stroke={hot ? AMBER : "#C9B8A8"} strokeWidth={hot ? 3 : 2} />;
        })}
        {laid.phantoms.map((ph) => {
          const par = pos.get(ph.parentKey)!;
          const pr = R * 0.62;
          return (
            <g key={"p" + ph.key}>
              <path d={`M ${par.x} ${par.y + R} C ${par.x} ${(par.y + ph.y) / 2}, ${ph.x} ${(par.y + ph.y) / 2}, ${ph.x} ${ph.y - pr}`} fill="none" stroke="#E4DBD2" strokeWidth={2} strokeDasharray="5 5" />
              {editable ? (
                <g role="button" tabIndex={0} aria-label={ph.side === "left" ? leftLabel : rightLabel} style={{ cursor: "pointer" }}
                  onClick={() => onAdd?.(ph.parentId, ph.side)} onKeyDown={(e) => key(e, () => onAdd?.(ph.parentId, ph.side))}>
                  <circle cx={ph.x} cy={ph.y} r={pr} fill="#fff" stroke="#B9A797" strokeWidth={2} strokeDasharray="5 4" />
                  <text x={ph.x} y={ph.y + fs * 0.9} textAnchor="middle" fontSize={fs * 2.2} fill="#9a8878">+</text>
                  <text x={ph.x} y={ph.y + pr + 16} textAnchor="middle" fontSize={11} fill="#9a8878">{ph.side === "left" ? leftLabel : rightLabel}</text>
                </g>
              ) : null}
            </g>
          );
        })}
        {laid.placed.map((p) => {
          const isRoot = p.key === "root";
          const hot = !isRoot && laid.heavyRoot !== null && legOf(p.key) === laid.heavyRoot;
          const sw = isRoot ? { fill: "#AB9080", stroke: "#8D7364" } : swatchOf(p.node!);
          const text = lines(isRoot ? ownerName : p.node!.label, maxChars);
          const rank = isRoot ? ownerRank : p.node!.rank;
          const startY = p.y - (rank ? fs * 0.45 : 0) - (text.length - 1) * (fs * 0.55);
          const click = isRoot ? onPickRoot : onPick ? () => onPick(p.node!.id) : undefined;
          return (
            <g key={p.key} className={click ? "ft-bubble" : undefined} role={click ? "button" : undefined} tabIndex={click ? 0 : undefined}
              aria-label={isRoot ? ownerName : p.node!.label} style={click ? { cursor: "pointer" } : undefined}
              onClick={click} onKeyDown={click ? (e) => key(e, click) : undefined}>
              <title>{isRoot ? ownerName : p.lopsided ? `${p.node!.label} (${p.left} · ${p.right})` : p.node!.label}</title>
              {p.lopsided ? <circle cx={p.x} cy={p.y} r={R + 8} fill="none" stroke={AMBER} strokeWidth={3} strokeDasharray="4 4" /> : null}
              {hot ? <circle cx={p.x} cy={p.y} r={R + 4} fill="none" stroke={AMBER} strokeWidth={2} /> : null}
              <circle cx={p.x} cy={p.y} r={R} fill={sw.fill} stroke={sw.stroke} strokeWidth={2.5} />
              {text.map((t, i) => <text key={i} x={p.x} y={startY + i * fs * 1.1 + fs * 0.35} textAnchor="middle" fontSize={fs} fontWeight={600} fill={isRoot ? "#fff" : "#2B2522"}>{t}</text>)}
              {rank ? <text x={p.x} y={p.y + R * 0.55} textAnchor="middle" fontSize={fs * 0.95} fontWeight={700} fill={isRoot ? "#fff" : sw.stroke}>{rank}</text> : null}
              {isRoot ? <text x={p.x} y={p.y - R - 12} textAnchor="middle" fontSize={12} fontWeight={700} fill="#8D7364" letterSpacing="1.5">{youLabel}</text> : null}
              {!isRoot && p.node!.linked_member_id ? <circle cx={p.x + R * 0.72} cy={p.y - R * 0.72} r={5} fill="#5E9C76" stroke="#fff" strokeWidth={1.5} /> : null}
            </g>
          );
        })}
        <g transform={`translate(${Math.max(0, (laid.width - 640) / 2)}, ${laid.height - 6})`} aria-hidden="true">
          {LEGEND.map((sw, i) => {
            const x = (i % 4) * 160, y = Math.floor(i / 4) * 24;
            return (
              <g key={sw.key} transform={`translate(${x}, ${y})`}>
                <circle cx={9} cy={9} r={8} fill={sw.fill} stroke={sw.stroke} strokeWidth={2} />
                <text x={24} y={13} fontSize={12} fill="#5b514a">{sw === OWNED ? "My accounts" : sw.label}</text>
              </g>
            );
          })}
        </g>
      </g>
    </svg>
  );
});
