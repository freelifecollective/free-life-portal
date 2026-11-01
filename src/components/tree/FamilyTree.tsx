"use client";

import { useRef, useState, useTransition } from "react";
import { setSharing } from "@/app/(app)/family-tree/actions";
import { downloadSvgAsPng } from "@/lib/tree/export";
import { balanceOf, buildTree, countAll, type Built, type Side, type TreeNode } from "@/lib/tree/layout";
import { NodeDialog, type DialogTarget } from "./NodeDialog";
import { TreeChart } from "./TreeChart";
import { KEY_POSITIONS, useKeyPos } from "./useKeyPos";
import { useWidth } from "./useWidth";

function find(b: Built, id: string): Built | null {
  if (b.node?.id === id) return b;
  return (b.left && find(b.left, id)) || (b.right && find(b.right, id)) || null;
}

/** Your Organization (the family tree): add, change and remove bubbles, see how even the two sides are, share a read-only link, and download or print it. */
export function FamilyTree({ initial, ownerName, ownerRank, token, rootEdited }: { initial: TreeNode[]; ownerName: string; ownerRank: string | null; token: string | null; rootEdited: boolean }) {
  const [nodes, setNodes] = useState<TreeNode[]>(initial);
  const [top, setTop] = useState({ name: ownerName, rank: ownerRank ?? "" });
  const [keyPos, setKeyPos] = useKeyPos();
  const [box, boxW] = useWidth<HTMLDivElement>();
  const [target, setTarget] = useState<DialogTarget | null>(null);
  const [tok, setTok] = useState<string | null>(token);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const svg = useRef<SVGSVGElement>(null);
  const root = buildTree(nodes);
  const bal = balanceOf(root);
  const link = tok && typeof window !== "undefined" ? `${window.location.origin}/tree/${tok}` : "";

  const openEdit = (id: string) => {
    const b = find(root, id);
    if (b?.node) setTarget({ mode: "edit", node: b.node, hasLeft: !!b.left, hasRight: !!b.right, branch: countAll(b) - 1 });
  };
  const gone = (id: string) => {
    const dead = new Set<string>([id]);
    let grew = true;
    while (grew) { grew = false; for (const n of nodes) if (n.parent_id && dead.has(n.parent_id) && !dead.has(n.id)) { dead.add(n.id); grew = true; } }
    setNodes(nodes.filter((n) => !dead.has(n.id)));
  };
  const download = async () => {
    if (!svg.current) return;
    setMsg("");
    try { await downloadSvgAsPng(svg.current, "your-organization.png"); } catch { setMsg("We could not make the picture. Try Print instead."); }
  };
  const share = (on: boolean) => start(async () => {
    const r = await setSharing(on);
    if (!r.ok) { setMsg(r.error); return; }
    setTok(r.token); setMsg("");
  });
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setMsg("Copy the link by hand."); } };

  return (
    <div className="ft">
      <section className={"card-s ft-balance" + (bal.lopsided ? " lopsided" : "")} role="status">
        <p className="ft-counts">{`Left side: ${bal.left} · Right side: ${bal.right}`}</p>
        <p style={{ margin: 0 }}>
          {nodes.length === 0 ? "Add your first accounts to see how balanced your tree is."
            : bal.lopsided ? (bal.heavy === "left" ? "Your tree is lopsided: your left side has more accounts. Add your next accounts on the right side to even it out." : "Your tree is lopsided: your right side has more accounts. Add your next accounts on the left side to even it out.")
            : "Nicely balanced! Keep stacking evenly."}
        </p>
        {bal.lopsided ? <p className="when" style={{ margin: 0 }}>The orange side is the heavier one. Bubbles with a dashed orange ring have an uneven branch under them.</p> : null}
      </section>

      <div className="ft-tools">
        <button type="button" className="btn small" onClick={download}>Download picture</button>
        <button type="button" className="btn small" onClick={() => window.print()}>Print or save as PDF</button>
        {tok ? <button type="button" className="btn small" disabled={pending} onClick={() => share(false)}>Stop sharing</button> : <button type="button" className="btn small" disabled={pending} onClick={() => share(true)}>Share a link</button>}
      </div>
      {tok ? (
        <div className="card-s ft-share">
          <label htmlFor="ft-link" className="when">Anyone with this link can look at your tree (they cannot change it). Stop sharing and the link stops working.</label>
          <div className="rs-actions" style={{ marginTop: 6 }}>
            <input id="ft-link" type="text" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="btn small" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
          </div>
        </div>
      ) : null}
      {msg ? <p className="err" role="alert" style={{ minHeight: 0 }}>{msg}</p> : null}

      <div className="ft-print">
        <h2 className="ft-print-title">{`${top.name}'s organization`}</h2>
        <div className="ft-keypos no-print" role="group" aria-label="Where the colour key sits">
          <span className="when">Colour key:</span>
          {KEY_POSITIONS.map((k) => <button key={k.id} type="button" className={keyPos === k.id ? "on" : ""} aria-pressed={keyPos === k.id} onClick={() => setKeyPos(k.id)}>{k.label}</button>)}
        </div>
        <div className="ft-scroll" ref={box}>
          <TreeChart ref={svg} keyPos={keyPos} availW={Math.max(0, boxW - 18)} nodes={nodes} ownerName={top.name} ownerRank={top.rank || null} leftLabel="Left" rightLabel="Right"
            onPick={openEdit} onPickRoot={() => setTarget({ mode: "root", label: rootEdited || top.name !== ownerName ? top.name : "", rank: top.rank })} onAdd={(parentId, side) => setTarget({ mode: "add", parentId, side })} />
        </div>
      </div>
      <p className="when">Tap a bubble to change it or add more under it. Tap a + to add someone on that side. Tap the top bubble to change your own name or rank.</p>

      <NodeDialog target={target} onClose={() => setTarget(null)}
        onRootSaved={(label, rank) => { setTop({ name: label || ownerName, rank: rank || (label ? "" : ownerRank ?? "") }); setTarget(null); }}
        onSaved={(n) => { setNodes((cur) => (cur.some((x) => x.id === n.id) ? cur.map((x) => (x.id === n.id ? n : x)) : [...cur, n])); setTarget(null); }}
        onRemoved={(id) => { gone(id); setTarget(null); }}
        onAddSide={(parentId, side: Side) => setTarget({ mode: "add", parentId, side })} />
    </div>
  );
}
