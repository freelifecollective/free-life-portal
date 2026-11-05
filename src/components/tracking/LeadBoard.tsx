"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addBoard, addCard, addList, affiliateCard, deleteBoard, deleteCard, deleteList, moveCard, registerCard, renameBoard, renameList, updateCard, type CardInput } from "@/app/(app)/tracking/actions";
import type { Board, Card } from "@/lib/tracking/types";

type Res = { ok: true; boards: Board[]; focus?: string } | { ok: false; error: string };
const blank: CardInput = { name: "", email: "", phone: "", note: "" };

/** An internal Trello: boards with lists with lead cards. Drag a card to move it, or use the two buttons on every card. */
export function LeadBoard({ initial }: { initial: Board[] }) {
  const router = useRouter();
  const [boards, setBoards] = useState(initial);
  const [boardId, setBoardId] = useState(initial[0]?.id ?? "");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; listId: string } | null>(null);
  const [vals, setVals] = useState<CardInput>(blank);
  const dlg = useRef<HTMLDialogElement>(null);
  const board = boards.find((b) => b.id === boardId) ?? boards[0];

  const run = (fn: () => Promise<Res>) => start(async () => {
    const r = await fn();
    if (r.ok) { setBoards(r.boards); setError(""); if (r.focus && r.boards.some((b) => b.id === r.focus)) setBoardId(r.focus); else if (!r.boards.some((b) => b.id === boardId)) setBoardId(r.boards[0]?.id ?? ""); }
    else setError(r.error);
  });
  const ask = (text: string, def = "") => { const v = window.prompt(text, def); return v === null ? null : v.trim(); };

  function openCard(listId: string, c?: Card) {
    setEditing({ id: c?.id ?? null, listId });
    setVals(c ? { name: c.name, email: c.email ?? "", phone: c.phone ?? "", note: c.note ?? "" } : blank);
    setError(""); dlg.current?.showModal();
  }
  function saveCard() {
    if (!editing) return;
    start(async () => {
      const r: Res = editing.id ? await updateCard(editing.id, vals) : await addCard(editing.listId, vals);
      if (r.ok) { setBoards(r.boards); setError(""); dlg.current?.close(); } else setError(r.error);
    });
  }
  function affiliate(c: Card) {
    if (!window.confirm(`Mark ${c.name} as affiliated? They move to your My Team page.`)) return;
    start(async () => { const r = await affiliateCard(c.id, "New"); if (r.ok) router.push(`/tracking/team?open=${r.teamId}&ask=1`); else setError(r.error); });
  }
  function drop(listId: string, index: number) {
    if (!drag) return;
    const id = drag; setDrag(null); setOver(null);
    /* show it in its new place straight away */
    let moved: Card | undefined;
    const next = boards.map((b) => ({ ...b, lists: b.lists.map((l) => { const f = l.cards.find((x) => x.id === id); if (f) moved = f; return { ...l, cards: l.cards.filter((x) => x.id !== id) }; }) }))
      .map((b) => ({ ...b, lists: b.lists.map((l) => { if (l.id !== listId || !moved) return l; const cs = [...l.cards]; cs.splice(index, 0, moved); return { ...l, cards: cs }; }) }));
    setBoards(next);
    run(() => moveCard(id, listId, index));
  }

  return (
    <div className="lb">
      <div className="lb-tabs" role="tablist" aria-label="Boards">
        {boards.map((b) => <button key={b.id} type="button" role="tab" aria-selected={b.id === board?.id} className={"chip" + (b.id === board?.id ? " on" : "")} onClick={() => setBoardId(b.id)}>{b.name}</button>)}
        <button type="button" className="chip" onClick={() => { const n = ask("Name your new board"); if (n) run(() => addBoard(n)); }}>+ New board</button>
      </div>
      {error ? <p className="err" role="alert">{error}</p> : null}
      {!board ? <p className="page-lede">You have no boards. Make one with “+ New board”.</p> : (
        <>
          <div className="lb-head">
            <h2 className="qh" style={{ margin: 0 }}>{board.name}</h2>
            <button type="button" className="linkbtn" onClick={() => { const n = ask("Rename this board", board.name); if (n) run(() => renameBoard(board.id, n)); }}>Rename</button>
            <button type="button" className="linkbtn" onClick={() => { if (window.confirm(`Delete the board “${board.name}” and every card on it?`)) run(() => deleteBoard(board.id)); }}>Delete board</button>
          </div>
          <div className="lb-cols">
            {board.lists.map((l) => (
              <section key={l.id} className={"lb-list" + (over === l.id ? " over" : "")} aria-label={l.name}
                onDragOver={(e) => { if (drag) { e.preventDefault(); setOver(l.id); } }} onDragLeave={() => setOver((o) => (o === l.id ? null : o))} onDrop={() => drop(l.id, l.cards.length)}>
                <header className="lb-list-h">
                  <button type="button" className="lb-list-name" title="Rename this list" onClick={() => { const n = ask("Rename this list", l.name); if (n) run(() => renameList(l.id, n)); }}>{l.name}</button>
                  <span className="lb-count">{l.cards.length}</span>
                  <button type="button" className="lb-x" aria-label={`Delete the list ${l.name}`} title="Delete this list" onClick={() => { if (window.confirm(`Delete the list “${l.name}”${l.cards.length ? ` and its ${l.cards.length} card${l.cards.length === 1 ? "" : "s"}` : ""}?`)) run(() => deleteList(l.id)); }}>×</button>
                </header>
                <ul className="lb-cards">
                  {l.cards.map((c, i) => (
                    <li key={c.id} className={"lb-card" + (drag === c.id ? " dragging" : "")} draggable onDragStart={() => setDrag(c.id)} onDragEnd={() => { setDrag(null); setOver(null); }}
                      onDragOver={(e) => { if (drag && drag !== c.id) { e.preventDefault(); e.stopPropagation(); setOver(l.id); } }} onDrop={(e) => { e.stopPropagation(); drop(l.id, i); }}>
                      <button type="button" className="lb-card-name" onClick={() => openCard(l.id, c)}>{c.name}</button>
                      {c.email || c.phone ? <span className="lb-meta" translate="no">{[c.email, c.phone].filter(Boolean).join(" · ")}</span> : null}
                      {c.note ? <span className="lb-note" translate="no">{c.note.length > 90 ? c.note.slice(0, 88) + "…" : c.note}</span> : null}
                      <span className="lb-acts">
                        <button type="button" className="linkbtn" disabled={pending} onClick={() => run(() => registerCard(c.id))}>Registered for the Portal</button>
                        <button type="button" className="linkbtn" disabled={pending} onClick={() => affiliate(c)}>Affiliated</button>
                        <button type="button" className="linkbtn" disabled={pending} onClick={() => { if (window.confirm(`Delete ${c.name}?`)) run(() => deleteCard(c.id)); }}>Delete</button>
                      </span>
                    </li>
                  ))}
                </ul>
                <button type="button" className="lb-add" onClick={() => openCard(l.id)}>+ Add a lead</button>
              </section>
            ))}
            <div className="lb-list lb-new"><button type="button" className="lb-add" onClick={() => { const n = ask("Name your new list"); if (n) run(() => addList(board.id, n)); }}>+ Add a list</button></div>
          </div>
        </>
      )}
      <dialog ref={dlg} className="rs-dialog" aria-labelledby="lb-dlg-title">
        <h2 id="lb-dlg-title" className="qh" style={{ marginTop: 0 }}>{editing?.id ? "Lead details" : "Add a lead"}</h2>
        <div className="field"><label htmlFor="lb-name">Name</label><input id="lb-name" value={vals.name} maxLength={80} onChange={(e) => setVals({ ...vals, name: e.target.value })} /></div>
        <div className="field"><label htmlFor="lb-email">Email (optional)</label><input id="lb-email" type="email" value={vals.email} maxLength={254} onChange={(e) => setVals({ ...vals, email: e.target.value })} /></div>
        <div className="field"><label htmlFor="lb-phone">Phone (optional)</label><input id="lb-phone" value={vals.phone} maxLength={40} onChange={(e) => setVals({ ...vals, phone: e.target.value })} /></div>
        <div className="field"><label htmlFor="lb-note">Notes (optional)</label><textarea id="lb-note" rows={4} maxLength={1000} value={vals.note} onChange={(e) => setVals({ ...vals, note: e.target.value })} /></div>
        {error ? <p className="err" role="alert">{error}</p> : null}
        <div className="dlg-actions"><button type="button" className="btn" onClick={() => dlg.current?.close()}>Cancel</button><button type="button" className="btn primary" disabled={pending} onClick={saveCard}>{pending ? "Saving…" : "Save"}</button></div>
      </dialog>
    </div>
  );
}
