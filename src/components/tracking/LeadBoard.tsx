"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addBoard, addCard, addList, addTag, affiliateCard, deleteBoard, deleteCard, deleteList, deleteTag, moveCard, registerCard, renameBoard, renameList, restoreBoards, updateCard, type CardInput } from "@/app/(app)/tracking/actions";
import type { Board, Card, Tag } from "@/lib/tracking/types";

type Res = { ok: true; boards: Board[]; tags: Tag[]; focus?: string } | { ok: false; error: string };
const blank: CardInput = { name: "", email: "", phone: "", instagram: "", facebook: "", note: "", tags: [], followUp: "", followDays: 3 };
/** Text on a tag: dark on light colours, white on dark ones. */
const ink = (hex: string) => { const n = parseInt(hex.slice(1), 16); const l = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); return l > 160 ? "#2B2522" : "#fff"; };
const today = () => new Date().toISOString().slice(0, 10);
const dayText = (d: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(d + "T00:00:00Z"));

/** An internal Trello: boards with lists with lead cards and colour tags. Drag a card to move it. Several things happen by themselves (tags, follow-ups). */
export function LeadBoard({ initial, initialTags }: { initial: Board[]; initialTags: Tag[] }) {
  const router = useRouter();
  const [boards, setBoards] = useState(initial);
  const [tags, setTags] = useState(initialTags);
  const [boardId, setBoardId] = useState(initial[0]?.id ?? "");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; listId: string } | null>(null);
  const [vals, setVals] = useState<CardInput>(blank);
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState("#8B6F5E");
  const [sure, setSure] = useState<Card | null>(null);
  const [past, setPast] = useState<Board[][]>([]);
  const [future, setFuture] = useState<Board[][]>([]);
  const dlg = useRef<HTMLDialogElement>(null);
  const sureDlg = useRef<HTMLDialogElement>(null);
  const board = boards.find((b) => b.id === boardId) ?? boards[0];
  const tagById = new Map(tags.map((t) => [t.id, t]));

  const apply = (r: Res, keepFocus = true) => {
    if (r.ok) { setBoards(r.boards); setTags(r.tags); setError(""); if (r.focus && r.boards.some((b) => b.id === r.focus)) setBoardId(r.focus); else if (keepFocus && !r.boards.some((b) => b.id === boardId)) setBoardId(r.boards[0]?.id ?? ""); }
    else setError(r.error);
  };
  /** Runs a change, remembering how the boards looked before it so it can be undone. */
  const run = (fn: () => Promise<Res>) => {
    const before = boards;
    start(async () => { const r = await fn(); if (r.ok) { setPast((p) => [...p.slice(-39), before]); setFuture([]); } apply(r); });
  };
  const undo = () => { const prev = past[past.length - 1]; if (!prev) return; const now = boards; setPast(past.slice(0, -1)); setFuture([...future, now]); setBoards(prev); start(async () => apply(await restoreBoards(prev))); };
  const redo = () => { const next = future[future.length - 1]; if (!next) return; const now = boards; setFuture(future.slice(0, -1)); setPast([...past, now]); setBoards(next); start(async () => apply(await restoreBoards(next))); };
  const ask = (text: string, def = "") => { const v = window.prompt(text, def); return v === null ? null : v.trim(); };

  function openCard(listId: string, c?: Card) {
    setEditing({ id: c?.id ?? null, listId });
    setVals(c ? { name: c.name, email: c.email ?? "", phone: c.phone ?? "", instagram: c.instagram ?? "", facebook: c.facebook ?? "", note: c.note ?? "", tags: c.tags, followUp: c.followUp ?? "", followDays: c.followDays } : blank);
    setError(""); dlg.current?.showModal();
  }
  function saveCard() {
    if (!editing) return;
    const before = boards;
    start(async () => {
      const r: Res = editing.id ? await updateCard(editing.id, vals) : await addCard(editing.listId, vals);
      if (r.ok) { setPast((p) => [...p.slice(-39), before]); setFuture([]); apply(r); dlg.current?.close(); } else setError(r.error);
    });
  }
  function affiliate(c: Card) {
    if (!window.confirm(`Mark ${c.name} as affiliated? They move to your My Team page.`)) return;
    start(async () => { const r = await affiliateCard(c.id, "1A"); if (r.ok) router.push(`/tracking/team?open=${r.teamId}&ask=1`); else setError(r.error); });
  }
  function drop(listId: string, index: number) {
    if (!drag) return;
    const id = drag; setDrag(null); setOver(null);
    let moved: Card | undefined;
    const next = boards.map((b) => ({ ...b, lists: b.lists.map((l) => { const f = l.cards.find((x) => x.id === id); if (f) moved = f; return { ...l, cards: l.cards.filter((x) => x.id !== id) }; }) }))
      .map((b) => ({ ...b, lists: b.lists.map((l) => { if (l.id !== listId || !moved) return l; const cs = [...l.cards]; cs.splice(index, 0, moved); return { ...l, cards: cs }; }) }));
    setBoards(next);
    start(async () => { const r = await moveCard(id, listId, index); if (r.ok) { setPast((p) => [...p.slice(-39), boards]); setFuture([]); } apply(r); });
  }
  const toggleTag = (id: string) => setVals((v) => ({ ...v, tags: v.tags.includes(id) ? v.tags.filter((t) => t !== id) : [...v.tags, id] }));

  return (
    <div className="lb">
      <div className="lb-tabs" role="tablist" aria-label="Boards">
        {boards.map((b) => <button key={b.id} type="button" role="tab" aria-selected={b.id === board?.id} className={"chip" + (b.id === board?.id ? " on" : "")} onClick={() => setBoardId(b.id)}>{b.name}</button>)}
        <button type="button" className="chip" onClick={() => { const n = ask("Name your new board"); if (n) run(() => addBoard(n)); }}>+ New board</button>
        <span className="lb-undo" role="group" aria-label="Undo and redo">
          <button type="button" className="icon-btn" aria-label="Undo" title="Undo" disabled={past.length === 0 || pending} onClick={undo}>←</button>
          <button type="button" className="icon-btn" aria-label="Redo" title="Redo" disabled={future.length === 0 || pending} onClick={redo}>→</button>
        </span>
      </div>
      {error ? <p className="err" role="alert">{error}</p> : null}
      {!board ? <p className="page-lede">You have no boards. Make one with “+ New board”.</p> : (
        <>
          <div className="lb-head">
            <h2 className="qh" style={{ margin: 0 }}>{board.name}</h2>
            <button type="button" className="linkbtn" onClick={() => { const n = ask("Rename this board", board.name); if (n) run(() => renameBoard(board.id, n)); }}>Rename</button>
            <button type="button" className="linkbtn" onClick={() => { if (window.confirm(`Delete the board “${board.name}” and every card on it? (You can undo this.)`)) run(() => deleteBoard(board.id)); }}>Delete board</button>
          </div>
          <div className="lb-cols">
            {board.lists.map((l) => (
              <section key={l.id} className={"lb-list" + (over === l.id ? " over" : "")} aria-label={l.name}
                onDragOver={(e) => { if (drag) { e.preventDefault(); setOver(l.id); } }} onDragLeave={() => setOver((o) => (o === l.id ? null : o))} onDrop={() => drop(l.id, l.cards.length)}>
                <header className="lb-list-h">
                  <button type="button" className="lb-list-name" title="Rename this list" onClick={() => { const n = ask("Rename this list", l.name); if (n) run(() => renameList(l.id, n)); }}>{l.name}</button>
                  <span className="lb-count">{l.cards.length}</span>
                  <button type="button" className="lb-x" aria-label={`Delete the list ${l.name}`} title="Delete this list" onClick={() => { if (window.confirm(`Delete the list “${l.name}”${l.cards.length ? ` and its ${l.cards.length} card${l.cards.length === 1 ? "" : "s"}` : ""}? (You can undo this.)`)) run(() => deleteList(l.id)); }}>×</button>
                </header>
                <ul className="lb-cards">
                  {l.cards.map((c, i) => {
                    const due = c.followUp && c.followUp <= today();
                    return (
                      <li key={c.id} className={"lb-card" + (drag === c.id ? " dragging" : "")} draggable onDragStart={() => setDrag(c.id)} onDragEnd={() => { setDrag(null); setOver(null); }}
                        onDragOver={(e) => { if (drag && drag !== c.id) { e.preventDefault(); e.stopPropagation(); setOver(l.id); } }} onDrop={(e) => { e.stopPropagation(); drop(l.id, i); }}>
                        <button type="button" className="lb-card-x" aria-label={`Delete ${c.name}`} title="Delete this lead" onClick={() => { setSure(c); sureDlg.current?.showModal(); }}>×</button>
                        {c.tags.length ? <span className="lb-tags">{c.tags.map((id) => { const t = tagById.get(id); return t ? <span key={id} className="lb-tag" style={{ background: t.color, color: ink(t.color) }}>{t.name}</span> : null; })}</span> : null}
                        <button type="button" className="lb-card-name" onClick={() => openCard(l.id, c)}>{c.name}</button>
                        {c.instagram || c.facebook ? <span className="lb-meta" translate="no">{[c.instagram, c.facebook].filter(Boolean).join(" · ")}</span> : null}
                        {c.email || c.phone ? <span className="lb-meta" translate="no">{[c.email, c.phone].filter(Boolean).join(" · ")}</span> : null}
                        {c.followUp ? <span className={"lb-date" + (due ? " late" : "")}>⏰ Follow up {dayText(c.followUp)}</span> : null}
                        {c.note ? <span className="lb-note" translate="no">{c.note.length > 90 ? c.note.slice(0, 88) + "…" : c.note}</span> : null}
                        <span className="lb-acts">
                          <button type="button" className="linkbtn" disabled={pending} onClick={() => run(() => registerCard(c.id))}>Registered for the Portal</button>
                          <button type="button" className="linkbtn" disabled={pending} onClick={() => affiliate(c)}>Affiliated</button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <button type="button" className="lb-add" onClick={() => openCard(l.id)}>+ Add a lead</button>
              </section>
            ))}
            <div className="lb-list lb-new"><button type="button" className="lb-add" onClick={() => { const n = ask("Name your new list"); if (n) run(() => addList(board.id, n)); }}>+ Add a list</button></div>
          </div>
        </>
      )}

      <dialog ref={dlg} className="rs-dialog lb-dialog" aria-labelledby="lb-dlg-title">
        <h2 id="lb-dlg-title" className="qh" style={{ marginTop: 0 }}>{editing?.id ? "Lead details" : "Add a lead"}</h2>
        <div className="lb-grid2">
          <div className="field"><label htmlFor="lb-name">Name</label><input id="lb-name" value={vals.name} maxLength={80} onChange={(e) => setVals({ ...vals, name: e.target.value })} /></div>
          <div className="field"><label htmlFor="lb-email">Email</label><input id="lb-email" type="email" value={vals.email} maxLength={254} onChange={(e) => setVals({ ...vals, email: e.target.value })} /></div>
          <div className="field"><label htmlFor="lb-ig">Instagram handle</label><input id="lb-ig" value={vals.instagram} maxLength={60} placeholder="@name" onChange={(e) => setVals({ ...vals, instagram: e.target.value })} /></div>
          <div className="field"><label htmlFor="lb-fb">Facebook name</label><input id="lb-fb" value={vals.facebook} maxLength={80} onChange={(e) => setVals({ ...vals, facebook: e.target.value })} /></div>
          <div className="field"><label htmlFor="lb-phone">Phone number</label><input id="lb-phone" value={vals.phone} maxLength={40} onChange={(e) => setVals({ ...vals, phone: e.target.value })} /></div>
        </div>
        <div className="field"><label htmlFor="lb-note">Notes</label><textarea id="lb-note" rows={3} maxLength={1000} value={vals.note} onChange={(e) => setVals({ ...vals, note: e.target.value })} /></div>
        <div className="lb-grid2">
          <div className="field"><label htmlFor="lb-fu">Next follow-up date</label><input id="lb-fu" type="date" value={vals.followUp} onChange={(e) => setVals({ ...vals, followUp: e.target.value })} /></div>
          <div className="field"><label htmlFor="lb-days">When I message them, follow up again after (days)</label><input id="lb-days" type="number" min={1} max={365} value={vals.followDays} onChange={(e) => setVals({ ...vals, followDays: Number(e.target.value) })} /></div>
        </div>
        <p className="when" style={{ margin: "0 0 10px" }}>When you send them a message in the portal, they move to Follow Up Set, and to Follow Up Due after this many days (3 unless you change it).</p>
        <fieldset className="lb-tagpick"><legend>Tags</legend>
          <div className="lb-tagrow">
            {tags.map((t) => (
              <span key={t.id} className="lb-tagwrap">
                <button type="button" className={"lb-tag pick" + (vals.tags.includes(t.id) ? " on" : "")} style={{ background: t.color, color: ink(t.color) }} aria-pressed={vals.tags.includes(t.id)} onClick={() => toggleTag(t.id)}>{vals.tags.includes(t.id) ? "✓ " : ""}{t.name}</button>
                {!t.system ? <button type="button" className="lb-tag-del" aria-label={`Delete the tag ${t.name}`} title="Delete this tag" onClick={() => { if (window.confirm(`Delete the tag “${t.name}” from every card?`)) { start(async () => { const r = await deleteTag(t.id); if (r.ok) { setVals((v) => ({ ...v, tags: v.tags.filter((x) => x !== t.id) })); } apply(r); }); } }}>×</button> : null}
              </span>
            ))}
          </div>
          <div className="lb-newtag">
            <input aria-label="New tag name" placeholder="Make your own tag…" value={tagName} maxLength={40} onChange={(e) => setTagName(e.target.value)} />
            <input aria-label="Tag colour" type="color" value={tagColor} onChange={(e) => setTagColor(e.target.value)} />
            <button type="button" className="btn small" disabled={pending || !tagName.trim()} onClick={() => start(async () => { const r = await addTag(tagName, tagColor); if (r.ok) setTagName(""); apply(r); })}>Add tag</button>
          </div>
        </fieldset>
        {error ? <p className="err" role="alert">{error}</p> : null}
        <div className="dlg-actions"><button type="button" className="btn" onClick={() => dlg.current?.close()}>Cancel</button><button type="button" className="btn primary" disabled={pending} onClick={saveCard}>{pending ? "Saving…" : "Save"}</button></div>
      </dialog>

      <dialog ref={sureDlg} className="rs-dialog" aria-labelledby="lb-sure-title" onClose={() => setSure(null)}>
        <h2 id="lb-sure-title" className="qh" style={{ marginTop: 0 }}>Delete this lead?</h2>
        <p>Are you sure you want to delete <strong translate="no">{sure?.name}</strong> from this list?</p>
        <p className="when">You can bring them back with the undo arrow at the top.</p>
        <div className="dlg-actions">
          <button type="button" className="btn" onClick={() => sureDlg.current?.close()}>Cancel</button>
          <button type="button" className="btn primary danger-fill" onClick={() => { const c = sure; sureDlg.current?.close(); if (c) run(() => deleteCard(c.id)); }}>Delete</button>
        </div>
      </dialog>
    </div>
  );
}
