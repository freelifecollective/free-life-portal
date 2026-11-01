"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { removeNode, saveNode } from "@/app/(app)/family-tree/actions";
import { createClient } from "@/lib/supabase/client";
import type { Side, TreeNode } from "@/lib/tree/layout";

const RANKS = ["1A", "2A", "3A", "4A", "5A", "6A", "6A+"];
type Person = { id: string; first_name: string | null; last_name: string | null };
const nameOf = (p: Person) => [p.first_name, p.last_name].filter(Boolean).join(" ") || "Member";

export type DialogTarget = { mode: "add"; parentId: string | null; side: Side } | { mode: "edit"; node: TreeNode; hasLeft: boolean; hasRight: boolean; branch: number };

/** Add a bubble, or change or remove one. You can pick someone from the FLC community or just type a name or account name. */
export function NodeDialog({ target, onClose, onSaved, onRemoved, onAddSide }: {
  target: DialogTarget | null; onClose: () => void; onSaved: (n: TreeNode) => void; onRemoved: (id: string) => void; onAddSide: (parentId: string, side: Side) => void;
}) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [label, setLabel] = useState("");
  const [rank, setRank] = useState("");
  const [linked, setLinked] = useState("");
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const key = target ? (target.mode === "edit" ? target.node.id : `${target.parentId}:${target.side}`) : "";

  useEffect(() => {
    if (!target) { dlg.current?.close(); return; }
    queueMicrotask(() => {
      setLabel(target.mode === "edit" ? target.node.label : ""); setRank(target.mode === "edit" ? target.node.rank ?? "" : "");
      setLinked(target.mode === "edit" ? target.node.linked_member_id ?? "" : ""); setError(""); setConfirm(false);
    });
    if (!dlg.current?.open) dlg.current?.showModal();
    if (!people) {
      const s = createClient();
      void Promise.all([s.rpc("member_directory", { p_kind: "affiliates" }), s.rpc("member_directory", { p_kind: "leads" })]).then(([a, l]) => {
        const all = [...((a.data ?? []) as Person[]), ...((l.data ?? []) as Person[])];
        setPeople(all.sort((x, y) => nameOf(x).localeCompare(nameOf(y))));
      });
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!target) return <dialog ref={dlg} className="rs-dialog" aria-label="Family tree bubble" />;

  const pick = (id: string) => {
    setLinked(id);
    const p = people?.find((x) => x.id === id);
    if (p) setLabel(nameOf(p).slice(0, 60));
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError("");
      const r = await saveNode(target.mode === "edit"
        ? { id: target.node.id, parentId: target.node.parent_id, side: target.node.side, label, rank, linkedId: linked || null }
        : { parentId: target.parentId, side: target.side, label, rank, linkedId: linked || null });
      if (!r.ok) { setError(r.error); return; }
      onSaved(r.node);
    });
  };
  const remove = () => start(async () => {
    if (target.mode !== "edit") return;
    const r = await removeNode(target.node.id);
    if (!r.ok) { setError(r.error); return; }
    onRemoved(target.node.id);
  });

  return (
    <dialog ref={dlg} className="rs-dialog" aria-label="Family tree bubble" onClose={onClose} onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}>
      <form onSubmit={submit} className="set-form">
        <h2 className="qh" style={{ margin: 0 }}>{target.mode === "add" ? (target.side === "left" ? "Add to the left" : "Add to the right") : "Edit this bubble"}</h2>
        <div className="field"><label htmlFor="ft-pick">Choose an FLC community member (optional)</label>
          <select id="ft-pick" value={linked} onChange={(e) => pick(e.target.value)}>
            <option value="">{people ? "Not a community member" : "Loading…"}</option>
            {(people ?? []).map((p) => <option key={p.id} value={p.id} data-i18n="skip">{nameOf(p)}</option>)}
          </select></div>
        <div className="field"><label htmlFor="ft-label">Or type a name or account name</label>
          <input id="ft-label" type="text" required maxLength={60} value={label} onChange={(e) => setLabel(e.target.value)} autoFocus /></div>
        <div className="field"><label htmlFor="ft-rank">Rank (optional)</label>
          <select id="ft-rank" value={rank} onChange={(e) => setRank(e.target.value)}><option value="">Not set</option>{RANKS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
        <p className="err" role="alert" style={{ minHeight: 0 }}>{error}</p>
        <div className="dlg-actions"><button className="btn" type="button" onClick={() => dlg.current?.close()}>Cancel</button><button className="btn primary" type="submit" disabled={pending}>{pending ? "Saving…" : target.mode === "add" ? "Add" : "Save changes"}</button></div>
        {target.mode === "edit" ? (
          <div className="ft-more">
            <div className="rs-actions">
              <button type="button" className="btn small" disabled={target.hasLeft} onClick={() => onAddSide(target.node.id, "left")}>Add to the left</button>
              <button type="button" className="btn small" disabled={target.hasRight} onClick={() => onAddSide(target.node.id, "right")}>Add to the right</button>
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
