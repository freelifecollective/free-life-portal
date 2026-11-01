"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createChart, deleteChart, moveNode, renameChart, setSharing } from "@/app/(app)/family-tree/actions";
import { downloadSvgAsPng } from "@/lib/tree/export";
import { balanceOf, buildTree, countAll, type Built, type Side, type TreeNode } from "@/lib/tree/layout";
import { NodeDialog, type DialogTarget } from "./NodeDialog";
import { TreeChart, type Place } from "./TreeChart";
import { KEY_POSITIONS, useKeyPos } from "./useKeyPos";
import { useWidth } from "./useWidth";

function find(b: Built, id: string): Built | null {
  if (b.node?.id === id) return b;
  for (const c of b.kids) { const f = find(c, id); if (f) return f; }
  return null;
}

/** Your Organization (the family tree): add, change and remove bubbles, see how even the two sides are, share a read-only link, and download or print it. */
export function FamilyTree({ chartId, chartName, charts, initial, ownerName, ownerRank, token, rootEdited }: { chartId: string; chartName: string; charts: { id: string; name: string }[]; initial: TreeNode[]; ownerName: string; ownerRank: string | null; token: string | null; rootEdited: boolean }) {
  const router = useRouter();
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
    if (b?.node) setTarget({ mode: "edit", node: b.node, hasLeft: b.kids.length > 0, hasRight: b.kids.length > 0, branch: countAll(b) - 1 });
  };
  const gone = (id: string) => {
    const dead = new Set<string>([id]);
    let grew = true;
    while (grew) { grew = false; for (const n of nodes) if (n.parent_id && dead.has(n.parent_id) && !dead.has(n.id)) { dead.add(n.id); grew = true; } }
    setNodes(nodes.filter((n) => !dead.has(n.id)));
  };
  const onMove = (id: string, parentId: string | null, side: Side, place?: Place) => {
    const cur = nodes.find((n) => n.id === id);
    if (!cur || (cur.parent_id === parentId && !place)) return;
    const before = nodes;
    /* it goes where it was dropped among the others under that account: first, right after one of them, or at the end */
    const rest = nodes.filter((n) => n.id !== id);
    const moved = { ...cur, parent_id: parentId, side };
    const same = (n: TreeNode) => n.parent_id === parentId;
    let at = rest.length;
    if (place?.first) { const f = rest.findIndex(same); if (f >= 0) at = f; }
    else if (place?.after) { const a = rest.findIndex((n) => n.id === place.after); if (a >= 0) at = a + 1; }
    setNodes([...rest.slice(0, at), moved, ...rest.slice(at)]);
    setMsg("");
    start(async () => {
      const r = await moveNode(id, parentId, side, place);
      if (!r.ok) { setNodes(before); setMsg(r.error); }
    });
  };
  const download = async () => {
    if (!svg.current) return;
    setMsg("");
    try { await downloadSvgAsPng(svg.current, "your-organization.png"); } catch { setMsg("We could not make the picture. Try Print instead."); }
  };
  const share = (on: boolean) => start(async () => {
    const r = await setSharing(chartId, on);
    if (!r.ok) { setMsg(r.error); return; }
    setTok(r.token); setMsg("");
  });
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCopy, setNewCopy] = useState(false);
  /* right-click (or press and hold) a chart to rename or delete it */
  const [menu, setMenu] = useState<{ x: number; y: number; id: string; name: string } | null>(null);
  const [renameFor, setRenameFor] = useState<{ id: string; name: string } | null>(null);
  const [deleteFor, setDeleteFor] = useState<{ id: string; name: string } | null>(null);
  const hold = useRef<number | undefined>(undefined);
  const openMenu = (x: number, y: number, id: string, name: string) => setMenu({ x: Math.min(x, window.innerWidth - 200), y: Math.min(y, window.innerHeight - 110), id, name });
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("mousedown", close); window.addEventListener("scroll", close, true); window.addEventListener("resize", close);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("mousedown", close); window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); window.removeEventListener("keydown", esc); };
  }, [menu]);
  const makeChart = () => start(async () => {
    setMsg("");
    const r = await createChart(newName, newCopy ? chartId : null);
    if (!r.ok) { setMsg(r.error); return; }
    setNewOpen(false); setNewName(""); setNewCopy(false);
    router.push(`/family-tree?chart=${r.id}`);
  });
  const doRename = () => start(async () => {
    if (!renameFor) return;
    setMsg("");
    const r = await renameChart(renameFor.id, renameFor.name);
    if (!r.ok) { setMsg(r.error); return; }
    setRenameFor(null); router.refresh();
  });
  const doDelete = () => start(async () => {
    if (!deleteFor) return;
    setMsg("");
    const r = await deleteChart(deleteFor.id);
    if (!r.ok) { setMsg(r.error); return; }
    const wasOpen = deleteFor.id === chartId;
    setDeleteFor(null);
    if (wasOpen) router.push("/family-tree"); else router.refresh();
  });
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setMsg("Copy the link by hand."); } };

  const status = nodes.length === 0 ? "Add your first accounts" : bal.lopsided ? `Lopsided: add to the ${bal.heavy === "left" ? "right" : "left"}` : "Balanced";
  const advice = nodes.length === 0 ? "Add your first accounts to see how balanced your tree is."
    : bal.lopsided ? `Your tree is lopsided: your ${bal.heavy} side has more accounts. Add your next accounts on the ${bal.heavy === "left" ? "right" : "left"} side to even it out. The orange side is the heavier one, and bubbles with a dashed orange ring have an uneven branch under them.`
    : "Nicely balanced! Keep stacking evenly.";
  return (
    <div className="ft">
      <div className="ft-charts" role="tablist" aria-label="Your charts">
        {charts.map((c) => (
          <Link key={c.id} href={`/family-tree?chart=${c.id}`} role="tab" aria-selected={c.id === chartId} className={c.id === chartId ? "on" : ""} scroll={false} translate="no" title="Right-click to rename or delete"
            onContextMenu={(e) => { e.preventDefault(); openMenu(e.clientX, e.clientY, c.id, c.name); }}
            onTouchStart={(e) => { const t = e.touches[0]; hold.current = window.setTimeout(() => openMenu(t.clientX, t.clientY, c.id, c.name), 550); }}
            onTouchMove={() => window.clearTimeout(hold.current)} onTouchEnd={() => window.clearTimeout(hold.current)} onTouchCancel={() => window.clearTimeout(hold.current)}>{c.name}</Link>
        ))}
        <button type="button" className="ft-newchart" onClick={() => setNewOpen(true)}>+ New chart</button>
      </div>
      {menu ? (
        <div className="mute-menu" role="menu" style={{ left: menu.x, top: menu.y }} onMouseDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
          <button type="button" role="menuitem" onClick={() => { setRenameFor({ id: menu.id, name: menu.name }); setMenu(null); }}>Rename</button>
          {charts.length > 1 ? <button type="button" role="menuitem" onClick={() => { setDeleteFor({ id: menu.id, name: menu.name }); setMenu(null); }}>Delete chart</button> : null}
        </div>
      ) : null}
      {renameFor ? (
        <form className="card-s ft-newform" onSubmit={(e) => { e.preventDefault(); doRename(); }}>
          <label htmlFor="ft-rename" className="when">Rename this chart</label>
          <div className="rs-actions" style={{ marginTop: 6, flexWrap: "wrap" }}>
            <input id="ft-rename" type="text" maxLength={60} required autoFocus value={renameFor.name} onChange={(e) => setRenameFor({ ...renameFor, name: e.target.value })} />
            <button type="submit" className="btn small primary" disabled={pending}>Save</button>
            <button type="button" className="btn small" onClick={() => setRenameFor(null)}>Cancel</button>
          </div>
        </form>
      ) : null}
      {deleteFor ? (
        <div className="card-s ft-newform" role="alertdialog">
          <p style={{ margin: "0 0 8px" }}>Delete <b translate="no">“{deleteFor.name}”</b> and everything in it?</p>
          <div className="rs-actions" style={{ margin: 0 }}>
            <button type="button" className="btn small danger-fill" disabled={pending} onClick={doDelete}>Yes, delete</button>
            <button type="button" className="btn small" onClick={() => setDeleteFor(null)}>No</button>
          </div>
        </div>
      ) : null}
      {newOpen ? (
        <form className="card-s ft-newform" onSubmit={(e) => { e.preventDefault(); makeChart(); }}>
          <label htmlFor="ft-newname" className="when">Name your new chart, for example “Vision board”</label>
          <div className="rs-actions" style={{ marginTop: 6, flexWrap: "wrap" }}>
            <input id="ft-newname" type="text" maxLength={60} required autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} />
            <button type="submit" className="btn small primary" disabled={pending}>Create</button>
            <button type="button" className="btn small" onClick={() => setNewOpen(false)}>Cancel</button>
          </div>
          <label className="check" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}><input type="checkbox" checked={newCopy} onChange={(e) => setNewCopy(e.target.checked)} /> <span>Start it as a copy of “{chartName}”</span></label>
        </form>
      ) : null}

      <div className="ft-print">
        <h2 className="ft-print-title">{`${top.name}'s organization`}</h2>
        <div className="ft-chartbox">
          <p className={"ft-mini" + (bal.lopsided ? " lopsided" : "")} role="status" title={advice}><b>{`Left ${bal.left} · Right ${bal.right}`}</b><span>{status}</span></p>
          <div className="ft-scroll" ref={box}>
            <TreeChart ref={svg} keyPos={keyPos} availW={Math.max(0, boxW - 18)} nodes={nodes} ownerName={top.name} ownerRank={top.rank || null} leftLabel="Left" rightLabel="Right"
              onPick={openEdit} onMove={onMove} onPickRoot={() => setTarget({ mode: "root", label: rootEdited || top.name !== ownerName ? top.name : "", rank: top.rank })} onAdd={(parentId, side) => setTarget({ mode: "add", parentId, side })} />
          </div>
        </div>
      </div>

      <div className="ft-tools">
        <button type="button" className="btn small" onClick={download}>Download picture</button>
        <button type="button" className="btn small" onClick={() => window.print()}>Print or save as PDF</button>
        {tok ? <button type="button" className="btn small" disabled={pending} onClick={() => share(false)}>Stop sharing</button> : <button type="button" className="btn small" disabled={pending} onClick={() => share(true)}>Share a link</button>}
      </div>
      <div className="ft-keypos no-print" role="group" aria-label="Where the colour key sits">
        <span className="when">Colour key:</span>
        {KEY_POSITIONS.map((k) => <button key={k.id} type="button" className={keyPos === k.id ? "on" : ""} aria-pressed={keyPos === k.id} onClick={() => setKeyPos(k.id)}>{k.label}</button>)}
      </div>
      {tok ? (
        <div className="card-s ft-share">
          <label htmlFor="ft-link" className="when">Anyone with this link can look at this chart (they cannot change it). Stop sharing and the link stops working.</label>
          <div className="rs-actions" style={{ marginTop: 6 }}>
            <input id="ft-link" type="text" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="btn small" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
          </div>
        </div>
      ) : null}
      {msg ? <p className="err" role="alert" style={{ minHeight: 0 }}>{msg}</p> : null}
      <p className="when">Tap a bubble to change it, or to add accounts under it (choose Add to the left or Add to the right). Tap the top bubble to change your own name or rank, or to add to it. To move a bubble (and everything under it), drag it onto another bubble, or drop it anywhere in the white space: a faded line shows which bubble it will hang from. On a phone, press and hold first.</p>

      <NodeDialog chartId={chartId} charts={charts} target={target} onClose={() => setTarget(null)}
        onRootSaved={(label, rank) => { setTop({ name: label || ownerName, rank: rank || (label ? "" : ownerRank ?? "") }); setTarget(null); }}
        onSaved={(n, side) => {
          setNodes((cur) => {
            if (cur.some((x) => x.id === n.id)) return cur.map((x) => (x.id === n.id ? n : x));
            /* "Add to the left" puts it first among its parent's accounts, "Add to the right" last */
            const first = side === "left" ? cur.findIndex((x) => x.parent_id === n.parent_id) : -1;
            return first >= 0 ? [...cur.slice(0, first), n, ...cur.slice(first)] : [...cur, n];
          });
          setTarget(null);
        }}
        onRemoved={(id) => { gone(id); setTarget(null); }}
        onAddSide={(parentId, side: Side) => setTarget({ mode: "add", parentId, side })} />
    </div>
  );
}
