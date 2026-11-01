"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { removeNode, saveNode, saveRoot } from "@/app/(app)/family-tree/actions";
import { createClient } from "@/lib/supabase/client";
import { TREE_RANKS } from "@/lib/tree/colors";
import type { Side, TreeNode } from "@/lib/tree/layout";

type Person = { id: string; first_name: string | null; last_name: string | null };
const nameOf = (p: Person) => [p.first_name, p.last_name].filter(Boolean).join(" ") || "Member";

export type DialogTarget = { mode: "root"; label: string; rank: string } | { mode: "add"; parentId: string | null; side: Side } | { mode: "edit"; node: TreeNode; hasLeft: boolean; hasRight: boolean; branch: number };

/** Add a bubble, or change or remove one. You can pick someone from the FLC community or just type a name or account name. */
export function NodeDialog({ chartId, target, onClose, onSaved, onRemoved, onAddSide, onRootSaved }: {
  chartId: string;
  target: DialogTarget | null; onClose: () => void; onSaved: (n: TreeNode, side?: Side) => void; onRootSaved: (label: string, rank: string) => void; onRemoved: (id: string) => void; onAddSide: (parentId: string | null, side: Side) => void;
}) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [label, setLabel] = useState("");
  const [rank, setRank] = useState("");
  const [linked, setLinked] = useState("");
  const [owned, setOwned] = useState(false);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const key = target ? (target.mode === "edit" ? target.node.id : target.mode === "root" ? "root" : `${target.parentId}:${target.side}`) : "";

  useEffect(() => {
    if (!target) { dlg.current?.close(); return; }
    queueMicrotask(() => {
      setLabel(target.mode === "edit" ? target.node.label : target.mode === "root" ? target.label : ""); setRank(target.mode === "edit" ? (target.node.rank === "6A2-3+" ? "6A2-3" : target.node.rank) ?? "" : target.mode === "root" ? target.rank : "");
      setLinked(target.mode === "edit" ? target.node.linked_member_id ?? "" : ""); setOwned(target.mode === "edit" ? !!target.node.owned : false); setError(""); setConfirm(false);
    });
    if (!dlg.current?.open) dlg.current?.showModal();
    if (!people && target.mode !== "root") {
      const s = createClient();
      void Promise.all([s.rpc("member_directory", { p_kind: "affiliates" }), s.rpc("member_directory", { p_kind: "leads" })]).then(([a, l]) => {
        const all = [...((a.data ?? []) as Person[]), ...((l.data ?? []) as Person[])];
        setPeople(all.sort((x, y) => nameOf(x).localeCompare(nameOf(y))));
      });
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!target) return <dialog ref={dlg} className="rs-dialog" aria-label="Your Organization bubble" />;

  const pick = (id: string) => {
    setLinked(id);
    const p = people?.find((x) => x.id === id);
    if (p) setLabel(nameOf(p).slice(0, 60));
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError("");
      if (target.mode === "root") {
        const rr = await saveRoot(chartId, label, rank);
        if (!rr.ok) { setError(rr.error); return; }
        onRootSaved(label.trim(), rank);
        return;
      }
      const r = await saveNode(target.mode === "edit"
        ? { id: target.node.id, chartId, parentId: target.node.parent_id, side: target.node.side, label, rank, linkedId: linked || null, owned }
        : { chartId, parentId: target.parentId, side: target.side, label, rank, linkedId: linked || null, owned });
      if (!r.ok) { setError(r.error); return; }
      onSaved(r.node, target.mode === "add" ? target.side : undefined);
    });
  };
  const remove = () => start(async () => {
    if (target.mode !== "edit") return;
    const r = await removeNode(target.node.id);
    if (!r.ok) { setError(r.error); return; }
    onRemoved(target.node.id);
  });

  return (
    <dialog ref={dlg} className="rs-dialog" aria-label="Your Organization bubble" onClose={onClose} onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}>
      <form onSubmit={submit} className="set-form">
        <h2 className="qh" style={{ margin: 0 }}>{target.mode === "root" ? "Edit your top bubble" : target.mode === "add" ? (target.side === "left" ? "Add to the left" : "Add to the right") : "Edit this bubble"}</h2>
        {target.mode !== "root" ? (
        <div className="field"><label htmlFor="ft-pick">Choose an FLC community member (optional)</label>
          <select id="ft-pick" value={linked} onChange={(e) => pick(e.target.value)}>
            <option value="">{people ? "Not a community member" : "Loading…"}</option>
            {(people ?? []).map((p) => <option key={p.id} value={p.id} data-i18n="skip">{nameOf(p)}</option>)}
          </select></div>
        ) : null}
        <div className="field"><label htmlFor="ft-label">{target.mode === "root" ? "Your name or account name" : "Or type a name or account name"}</label>
          <input id="ft-label" type="text" required={target.mode !== "root"} maxLength={60} value={label} onChange={(e) => setLabel(e.target.value)} autoFocus /></div>
        <div className="field"><label htmlFor="ft-rank">Rank (optional)</label>
          <select id="ft-rank" value={rank} onChange={(e) => setRank(e.target.value)}><option value="">Not set</option>{TREE_RANKS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
        {target.mode !== "root" ? <label className="check" style={{ display: "flex", gap: 10, alignItems: "flex-start" }}><input type="checkbox" checked={owned} onChange={(e) => setOwned(e.target.checked)} style={{ marginTop: 4 }} /><span>I own this account</span></label> : <p className="when" style={{ margin: 0 }}>Leave the name empty to use your profile name.</p>}
        <p className="err" role="alert" style={{ minHeight: 0 }}>{error}</p>
        <div className="dlg-actions"><button className="btn" type="button" onClick={() => dlg.current?.close()}>Cancel</button><button className="btn primary" type="submit" disabled={pending}>{pending ? "Saving…" : target.mode === "add" ? "Add" : "Save changes"}</button></div>
        {target.mode === "root" ? (
          <div className="ft-more">
            <div className="rs-actions">
              <button type="button" className="btn small" onClick={() => onAddSide(null, "left")}>Add to the left</button>
              <button type="button" className="btn small" onClick={() => onAddSide(null, "right")}>Add to the right</button>
            </div>
          </div>
        ) : null}
        {target.mode === "edit" ? (
          <div className="ft-more">
            <div className="rs-actions">
              <button type="button" className="btn small" onClick={() => onAddSide(target.node.id, "left")}>{target.hasLeft ? "Add another to the left" : "Add to the left"}</button>
              <button type="button" className="btn small" onClick={() => onAddSide(target.node.id, "right")}>{target.hasRight ? "Add another to the right" : "Add to the right"}</button>
            </div>
            {confirm ? (
              <p className="err" style={{ minHeight: 0, margin: 0 }}>Remove this bubble and everything under it? <button type="button" className="linkbtn danger" disabled={pending} onClick={remove}>Yes, remove</button> <button type="button" className="linkbtn" onClick={() => setConfirm(false)}>No</button></p>
            ) : <button type="button" className="linkbtn danger" onClick={() => setConfirm(true)}>Remove this bubble</button>}
          </div>
        ) : null}
      </form>
    </dialog>
  );
}
