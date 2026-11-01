"use client";

import { forwardRef, useMemo } from "react";
import { buildTree, layoutTree, NODE_R, type Side, type TreeNode } from "@/lib/tree/layout";

const AMBER = "#D9962B";

function lines(label: string): string[] {
  const words = label.trim().split(/\s+/);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= 11) cur += " " + w;
    else { out.push(cur); cur = w; }
  }
  if (cur) out.push(cur);
  const fit = out.slice(0, 2).map((s) => (s.length > 11 ? s.slice(0, 10) + "…" : s));
  if (out.length > 2) fit[1] = fit[1].replace(/…?$/, "…");
  return fit;
}

/** The bubble chart. The owner is the top bubble; every bubble has a left and a right side. Nothing in here is editable by itself. */
export const TreeChart = forwardRef<SVGSVGElement, {
  nodes: TreeNode[]; ownerName: string; ownerRank?: string | null; youLabel: string; leftLabel: string; rightLabel: string;
  onPick?: (id: string) => void; onAdd?: (parentId: string | null, side: Side) => void;
}>(function TreeChart({ nodes, ownerName, ownerRank, youLabel, leftLabel, rightLabel, onPick, onAdd }, ref) {
  const laid = useMemo(() => layoutTree(buildTree(nodes)), [nodes]);
  const pos = new Map(laid.placed.map((p) => [p.key, p]));
  /* which of the owner's two sides a bubble belongs to, so the heavier side can be tinted */
  const legOf = (key: string): Side | null => {
    let p = pos.get(key);
    while (p && p.parentKey && p.parentKey !== "root") p = pos.get(p.parentKey);
    return p && p.parentKey === "root" ? p.side : null;
  };
  const editable = !!onPick;
  const W = Math.max(laid.width, 420), H = laid.height + 24;
  const shift = (W - laid.width) / 2;
  return (
    <svg ref={ref} width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${ownerName}`} className="ft-svg">
      <g transform={`translate(${shift}, 8)`}>
        {laid.placed.filter((p) => p.parentKey).map((p) => {
          const par = pos.get(p.parentKey!)!;
          const hot = laid.heavyRoot !== null && legOf(p.key) === laid.heavyRoot;
          const midY = (par.y + NODE_R + p.y - NODE_R) / 2;
          return <path key={"l" + p.key} d={`M ${par.x} ${par.y + NODE_R} C ${par.x} ${midY}, ${p.x} ${midY}, ${p.x} ${p.y - NODE_R}`} fill="none" stroke={hot ? AMBER : "#C9B8A8"} strokeWidth={hot ? 3 : 2} />;
        })}
        {laid.phantoms.map((ph) => {
          const par = pos.get(ph.parentKey)!;
          return (
            <g key={"p" + ph.key}>
              <path d={`M ${par.x} ${par.y + NODE_R} C ${par.x} ${(par.y + ph.y) / 2}, ${ph.x} ${(par.y + ph.y) / 2}, ${ph.x} ${ph.y - 26}`} fill="none" stroke="#E4DBD2" strokeWidth={2} strokeDasharray="5 5" />
              {editable ? (
                <g className="ft-plus" role="button" tabIndex={0} aria-label={ph.side === "left" ? leftLabel : rightLabel} style={{ cursor: "pointer" }}
                  onClick={() => onAdd?.(ph.parentId, ph.side)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAdd?.(ph.parentId, ph.side); } }}>
                  <circle cx={ph.x} cy={ph.y} r={26} fill="#fff" stroke="#B9A797" strokeWidth={2} strokeDasharray="5 4" />
                  <text x={ph.x} y={ph.y + 8} textAnchor="middle" fontSize="26" fill="#9a8878">+</text>
                  <text x={ph.x} y={ph.y + 46} textAnchor="middle" fontSize="11" fill="#9a8878">{ph.side === "left" ? leftLabel : rightLabel}</text>
                </g>
              ) : null}
            </g>
          );
        })}
        {laid.placed.map((p) => {
          const isRoot = p.key === "root";
          const hot = !isRoot && laid.heavyRoot !== null && legOf(p.key) === laid.heavyRoot;
          const text = isRoot ? lines(ownerName) : lines(p.node!.label);
          const rank = isRoot ? ownerRank : p.node!.rank;
          const startY = p.y - (rank ? 6 : 0) - (text.length - 1) * 7;
          return (
            <g key={p.key} className={editable && !isRoot ? "ft-bubble" : undefined} role={editable && !isRoot ? "button" : undefined} tabIndex={editable && !isRoot ? 0 : undefined}
              aria-label={isRoot ? undefined : p.node!.label} style={editable && !isRoot ? { cursor: "pointer" } : undefined}
              onClick={editable && !isRoot ? () => onPick?.(p.node!.id) : undefined}
              onKeyDown={editable && !isRoot ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick?.(p.node!.id); } } : undefined}>
              <title>{isRoot ? ownerName : p.lopsided ? `${p.node!.label} (${p.left} · ${p.right})` : p.node!.label}</title>
              {p.lopsided ? <circle cx={p.x} cy={p.y} r={NODE_R + 7} fill="none" stroke={AMBER} strokeWidth={3} strokeDasharray="4 4" /> : null}
              <circle cx={p.x} cy={p.y} r={NODE_R} fill={isRoot ? "#AB9080" : hot ? "#FBF0DC" : "#F1EFE9"} stroke={isRoot ? "#8D7364" : hot ? AMBER : "#B9A797"} strokeWidth={2.5} />
              {text.map((t, i) => <text key={i} x={p.x} y={startY + i * 14 + 4} textAnchor="middle" fontSize="12.5" fontWeight={600} fill={isRoot ? "#fff" : "#2B2522"}>{t}</text>)}
              {rank ? <text x={p.x} y={p.y + 22} textAnchor="middle" fontSize="12" fontWeight={700} fill={isRoot ? "#fff" : "#8D7364"}>{rank}</text> : null}
              {isRoot ? <text x={p.x} y={p.y - NODE_R - 10} textAnchor="middle" fontSize="12" fontWeight={700} fill="#8D7364" letterSpacing="1.5">{youLabel}</text> : null}
              {!isRoot && p.node!.linked_member_id ? <circle cx={p.x + NODE_R * 0.72} cy={p.y - NODE_R * 0.72} r={5} fill="#5E9C76" stroke="#fff" strokeWidth={1.5} /> : null}
            </g>
          );
        })}
      </g>
    </svg>
  );
});

