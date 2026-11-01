"use client";

import { useRef } from "react";
import { downloadSvgAsPng } from "@/lib/tree/export";
import { balanceOf, buildTree, type TreeNode } from "@/lib/tree/layout";
import { TreeChart } from "./TreeChart";

/** The read-only copy someone sees through a share link. */
export function SharedTree({ ownerName, ownerRank, nodes }: { ownerName: string; ownerRank: string | null; nodes: TreeNode[] }) {
  const svg = useRef<SVGSVGElement>(null);
  const bal = balanceOf(buildTree(nodes));
  return (
    <main className="ft" style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 16px 60px" }}>
      <h1 className="page-heading">{`${ownerName}'s organization`}</h1>
      <p className="ft-counts">{`Left side: ${bal.left} · Right side: ${bal.right}`}</p>
      <div className="ft-tools">
        <button type="button" className="btn small" onClick={() => svg.current && void downloadSvgAsPng(svg.current, "your-organization.png")}>Download picture</button>
        <button type="button" className="btn small" onClick={() => window.print()}>Print or save as PDF</button>
      </div>
      <div className="ft-print"><div className="ft-scroll"><TreeChart ref={svg} nodes={nodes} ownerName={ownerName} ownerRank={ownerRank} youLabel="" leftLabel="Left" rightLabel="Right" /></div></div>
    </main>
  );
}
