"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addBoard, addCard, addList, addTag, affiliateCard, getBoards, deleteBoard, deleteCard, deleteList, deleteTag, moveCard, moveList, registerCard, renameBoard, renameList, restoreBoards, updateCard, type CardInput } from "@/app/(app)/tracking/actions";
import { openDockChat } from "@/components/messages/MessageDock";
import { UndoRedo } from "@/components/UndoRedo";
import type { Board, Card, Tag } from "@/lib/tracking/types";

type Res = { ok: true; boards: Board[]; tags: Tag[]; focus?: string } | { ok: false; error: string };
const blank: CardInput = { name: "", email: "", phone: "", instagram: "", facebook: "", note: "", tags: [], followUp: "", followDays: 3 };
/** Text on a tag: dark on light colours, white on dark ones. */
const ink = (hex: string) => { const n = parseInt(hex.slice(1), 16); const l = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); return l > 160 ? "#2B2522" : "#fff"; };
const today = () => new Date().toISOString().slice(0, 10);
const dayText = (d: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(d + "T00:00:00Z"));
/** Green when the follow-up is two or more days away, yellow when it is tomorrow, red when it is due (or late). */
function tone(due: string): "ok" | "soon" | "late" {
  const days = Math.round((Date.parse(due + "T00:00:00Z") - Date.parse(today() + "T00:00:00Z")) / 86_400_000);
  return days >= 2 ? "ok" : days === 1 ? "soon" : "late";
}

/* like Trello: tapping any tag on a card shrinks all tags to little colour bars, tapping again brings the names back (remembered on this device) */
const TAGS_KEY = "flc_tags_compact";
const tagListeners = new Set<() => void>();
const subscribeTags = (cb: () => void) => { tagListeners.add(cb); window.addEventListener("storage", cb); return () => { tagListeners.delete(cb); window.removeEventListener("storage", cb); }; };
const readCompact = () => { try { return localStorage.getItem(TAGS_KEY) === "1"; } catch { return false; } };
const setCompact = (on: boolean) => { try { localStorage.setItem(TAGS_KEY, on ? "1" : "0"); } catch { /* still works this visit */ } tagListeners.forEach((l) => l()); };

/** True when a click on a pop-up's backdrop landed outside the pop-up itself (clicks on its own padding do not count). */
const clickedOutside = (e: React.MouseEvent<HTMLElement>) => { const r = e.currentTarget.getBoundingClientRect(); return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom; };

/** An internal Trello: boards with lists with lead cards and colour tags. Drag a card to move it. Several things happen by themselves (tags, follow-ups). */
export function LeadBoard({ initial, initialTags }: { initial: Board[]; initialTags: Tag[] }) {
  const router = useRouter();
  const [boards, setBoards] = useState(initial);
  const [tags, setTags] = useState(initialTags);
  const [boardId, setBoardId] = useState(initial[0]?.id ?? "");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [drag, setDrag] = useState<string | null>(null);
  const [dragList, setDragList] = useState<string | null>(null);
  /* while something is being dragged, where it would land: the other cards (or lists) slide apart to make room, like Trello */
  const [preview, setPreview] = useState<{ listId: string; index: number } | null>(null);
  const [listPreview, setListPreview] = useState<number | null>(null);
  const [dragH, setDragH] = useState(70);
  /* right-click (or press and hold) on the board name: Rename and Delete board */
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const holdTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!menu) return;
    const away = (e: Event) => { if (!(e.target as HTMLElement).closest?.(".ctx-menu")) setMenu(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(null); };
    document.addEventListener("pointerdown", away); document.addEventListener("keydown", esc); window.addEventListener("scroll", () => setMenu(null), { once: true });
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [menu]);
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
  const compact = useSyncExternalStore(subscribeTags, readCompact, () => false);

  /* the board checks for changes now and then (a lead messaged, a follow-up came due) while you are not in the middle of something */
  const busyRef = useRef(false);
  useEffect(() => { busyRef.current = pending || !!drag || !!dragList || !!editing || !!sure; });
  useEffect(() => {
    const refresh = () => { if (document.hidden || busyRef.current) return; void getBoards().then((r) => { if (r.ok && !busyRef.current) { setBoards(r.boards); setTags(r.tags); } }); };
    const t = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(t); window.removeEventListener("focus", refresh); };
  }, []);
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
  function commitCard() {
    const id = drag, p = preview;
    setDrag(null); setPreview(null);
    if (!id || !p) return;
    let moved: Card | undefined;
    const next = boards.map((b) => ({ ...b, lists: b.lists.map((l) => { const f = l.cards.find((x) => x.id === id); if (f) moved = f; return { ...l, cards: l.cards.filter((x) => x.id !== id) }; }) }))
      .map((b) => ({ ...b, lists: b.lists.map((l) => { if (l.id !== p.listId || !moved) return l; const cs = [...l.cards]; cs.splice(p.index, 0, moved); return { ...l, cards: cs }; }) }));
    setBoards(next);
    start(async () => { const r = await moveCard(id, p.listId, p.index); if (r.ok) { setPast((q) => [...q.slice(-39), boards]); setFuture([]); } apply(r); });
  }
  function commitList() {
    const id = dragList, idx = listPreview;
    setDragList(null); setListPreview(null);
    if (!id || idx === null || !board) return;
    const mine = board.lists.find((l) => l.id === id); if (!mine) return;
    const lists = board.lists.filter((l) => l.id !== id); lists.splice(idx, 0, mine);
    if (lists.every((l, i) => l.id === board.lists[i].id)) return;
    const before = boards;
    setBoards(boards.map((b) => (b.id === board.id ? { ...b, lists } : b)));
    start(async () => { const r = await moveList(id, idx); if (r.ok) { setPast((q) => [...q.slice(-39), before]); setFuture([]); } apply(r); });
  }
  const toggleTag = (id: string) => setVals((v) => ({ ...v, tags: v.tags.includes(id) ? v.tags.filter((t) => t !== id) : [...v.tags, id] }));

  return (
    <div className="lb">
      <div className="lb-tabs" role="tablist" aria-label="Boards">
        {boards.map((b) => <button key={b.id} type="button" role="tab" aria-selected={b.id === board?.id} className={"chip" + (b.id === board?.id ? " on" : "")} onClick={() => setBoardId(b.id)}>{b.name}</button>)}
        <button type="button" className="chip" onClick={() => { const n = ask("Name your new board"); if (n) run(() => addBoard(n)); }}>+ New board</button>
        <span className="lb-undo"><UndoRedo canUndo={past.length > 0} canRedo={future.length > 0} busy={pending} onUndo={undo} onRedo={redo} /></span>
      </div>
      {error ? <p className="err" role="alert">{error}</p> : null}
      {!board ? <p className="page-lede">You have no boards. Make one with “+ New board”.</p> : (
        <>
          <div className="lb-head">
            <h2 className="qh lb-title" style={{ margin: 0 }} tabIndex={0} title="Right-click for options"
              onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); }}
              onKeyDown={(e) => { if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); setMenu({ x: r.left, y: r.bottom }); } }}
              onTouchStart={(e) => { const t = e.touches[0]; holdTimer.current = window.setTimeout(() => setMenu({ x: t.clientX, y: t.clientY }), 550); }}
              onTouchEnd={() => { if (holdTimer.current) window.clearTimeout(holdTimer.current); }} onTouchMove={() => { if (holdTimer.current) window.clearTimeout(holdTimer.current); }}>{board.name}</h2>
          </div>
          {menu ? (
            <div className="ctx-menu" role="menu" style={{ left: Math.min(menu.x, window.innerWidth - 190), top: menu.y }}>
              <button type="button" role="menuitem" onClick={() => { setMenu(null); const n = ask("Rename this board", board.name); if (n) run(() => renameBoard(board.id, n)); }}>Rename</button>
              <button type="button" role="menuitem" className="danger" onClick={() => { setMenu(null); if (window.confirm(`Delete the board “${board.name}” and every card on it? (You can undo this.)`)) run(() => deleteBoard(board.id)); }}>Delete board</button>
            </div>
          ) : null}
          <div className="lb-cols" onDragOver={(e) => { if (dragList) { e.preventDefault(); const n = board.lists.filter((x) => x.id !== dragList).length; if (listPreview !== n) setListPreview(n); } }} onDrop={() => { if (dragList) commitList(); }}>
            {(() => {
              const out: React.ReactNode[] = [];
              const visibleLists = board.lists.filter((l) => l.id !== dragList);
              let vi = 0;
              const listGap = (k: string) => <div key={k} className="lb-list lb-list-gap" aria-hidden="true" onDragOver={(e) => { if (dragList) e.preventDefault(); }} onDrop={() => commitList()} />;
              for (const l of board.lists) {
                const hidden = l.id === dragList;
                if (!hidden) { if (listPreview === vi) out.push(listGap(`gap-${l.id}`)); vi++; }
                const visible = l.cards.filter((x) => x.id !== drag);
                const items: ({ card: Card } | { gap: true })[] = visible.map((card) => ({ card }));
                if (drag && preview?.listId === l.id) items.splice(Math.min(preview.index, items.length), 0, { gap: true });
                out.push(
              <section key={l.id} className={"lb-list" + (hidden ? " drag-source" : "")} aria-label={l.name}
                onDragOver={(e) => {
                  if (dragList) { if (dragList === l.id) return; e.preventDefault(); e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); const idx = visibleLists.findIndex((x) => x.id === l.id) + (e.clientX > r.left + r.width / 2 ? 1 : 0); if (listPreview !== idx) setListPreview(idx); }
                  else if (drag) { e.preventDefault(); const idx = (e.target as HTMLElement).closest(".lb-list-h") ? 0 : visible.length; if (!preview || preview.listId !== l.id || preview.index !== idx) setPreview({ listId: l.id, index: idx }); }
                }}
                onDrop={(e) => { if (dragList) { e.stopPropagation(); commitList(); } else commitCard(); }}>
                <header className="lb-list-h" draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", l.id); e.dataTransfer.effectAllowed = "move"; setTimeout(() => setDragList(l.id), 0); }} onDragEnd={() => { setDragList(null); setListPreview(null); }}>
                  <span className="lb-grip" aria-hidden="true" title="Drag to move this list">⋮⋮</span>
                  <button type="button" className="lb-list-name" title="Rename this list" onClick={() => { const n = ask("Rename this list", l.name); if (n) run(() => renameList(l.id, n)); }}>{l.name}</button>
                  <span className="lb-count">{l.cards.length}</span>
                  <button type="button" className="lb-x" aria-label={`Delete the list ${l.name}`} title="Delete this list" onClick={() => { if (window.confirm(`Delete the list “${l.name}”${l.cards.length ? ` and its ${l.cards.length} card${l.cards.length === 1 ? "" : "s"}` : ""}? (You can undo this.)`)) run(() => deleteList(l.id)); }}>×</button>
                </header>
                <ul className="lb-cards">
                  {items.map((it) => {
                    if ("gap" in it) return <li key="gap" className="lb-gap" style={{ height: dragH }} aria-hidden="true" onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }} onDrop={(e) => { e.stopPropagation(); commitCard(); }} />;
                    const c = it.card;
                    return (
                      <li key={c.id} className={"lb-card" + (drag === c.id ? " drag-source" : "")} onClick={(e) => { if ((e.target as HTMLElement).closest("button, a")) return; openCard(l.id, c); }} draggable onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData("text/plain", c.id); e.dataTransfer.effectAllowed = "move"; setDragH(e.currentTarget.getBoundingClientRect().height); setTimeout(() => setDrag(c.id), 0); }} onDragEnd={() => { setDrag(null); setPreview(null); }}
                        onDragOver={(e) => { if (!drag || drag === c.id) return; e.preventDefault(); e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); const idx = visible.findIndex((x) => x.id === c.id) + (e.clientY > r.top + r.height / 2 ? 1 : 0); if (!preview || preview.listId !== l.id || preview.index !== idx) setPreview({ listId: l.id, index: idx }); }} onDrop={(e) => { e.stopPropagation(); commitCard(); }}>
                        <button type="button" className="lb-card-x" aria-label={`Delete ${c.name}`} title="Delete this lead" onClick={() => { setSure(c); sureDlg.current?.showModal(); }}>×</button>
                        {c.tags.length ? <span className={"lb-tags" + (compact ? " compact" : "")}>{c.tags.map((id) => { const t = tagById.get(id); return t ? <button type="button" key={id} className={"lb-tag flip" + (compact ? " compact" : "")} style={{ background: t.color, color: ink(t.color) }} title={compact ? `${t.name} (tap to show names)` : "Tap to shrink the tags"} aria-label={compact ? t.name : `${t.name}. Tap to shrink the tags`} onClick={() => setCompact(!compact)}>{compact ? "" : t.name}</button> : null; })}</span> : null}
                        <button type="button" className="lb-card-name" onClick={() => openCard(l.id, c)}>{c.name}</button>
                        {c.instagram ? <span className="lb-ig" translate="no">📷 {c.instagram.startsWith("@") ? c.instagram : "@" + c.instagram}</span> : null}
                        {c.facebook ? <span className="lb-meta" translate="no">Facebook: {c.facebook}</span> : null}
                        {c.email || c.phone ? <span className="lb-meta" translate="no">{[c.email, c.phone].filter(Boolean).join(" · ")}</span> : null}
                        {c.followUp ? <span className={"lb-date " + tone(c.followUp)} title="When they were added, and when your follow-up is due">🕓 {c.createdAt ? `${dayText(c.createdAt.slice(0, 10))} - ` : ""}{dayText(c.followUp)}</span> : c.createdAt ? <span className="lb-date none" title="When they were added">🕓 {dayText(c.createdAt.slice(0, 10))}</span> : null}
                        {c.note ? <span className="lb-note" translate="no">{c.note.length > 90 ? c.note.slice(0, 88) + "…" : c.note}</span> : null}
                        <span className="lb-acts">
                          {c.portalId ? <button type="button" className="linkbtn lb-link" onClick={() => openDockChat(c.portalId!)}>Send Message</button> : null}
                          {board.kind !== "portal" ? <button type="button" className="linkbtn" disabled={pending} onClick={() => run(() => registerCard(c.id))}>Registered for the Portal</button> : null}
                          <button type="button" className="linkbtn" disabled={pending} onClick={() => affiliate(c)}>Affiliated</button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <button type="button" className="lb-add" onClick={() => openCard(l.id)}>+ Add a lead</button>
              </section>
                );
              }
              if (listPreview !== null && listPreview >= vi) out.push(listGap("gap-end"));
              return out;
            })()}
            <div className="lb-list lb-new"><button type="button" className="lb-add" onClick={() => { const n = ask("Name your new list"); if (n) run(() => addList(board.id, n)); }}>+ Add a list</button></div>
          </div>
        </>
      )}

      <dialog ref={dlg} className="rs-dialog lb-dialog" aria-labelledby="lb-dlg-title" onMouseDown={(e) => { if (clickedOutside(e)) dlg.current?.close(); }}>
        <h2 id="lb-dlg-title" className="qh" style={{ marginTop: 0 }}>{editing?.id ? "Lead details" : "Add a lead"}</h2>
        <div className="lb-grid2">
          <div className="field"><label htmlFor="lb-name">Name</label><input id="lb-name" type="text" value={vals.name} maxLength={80} onChange={(e) => setVals({ ...vals, name: e.target.value })} /></div>
          <div className="field"><label htmlFor="lb-email">Email</label><input id="lb-email" type="email" value={vals.email} maxLength={254} onChange={(e) => setVals({ ...vals, email: e.target.value })} /></div>
          <div className="field"><label htmlFor="lb-ig">Instagram handle</label><input id="lb-ig" type="text" value={vals.instagram} maxLength={60} placeholder="@name" onChange={(e) => setVals({ ...vals, instagram: e.target.value })} /></div>
          <div className="field"><label htmlFor="lb-fb">Facebook name</label><input id="lb-fb" type="text" value={vals.facebook} maxLength={80} onChange={(e) => setVals({ ...vals, facebook: e.target.value })} /></div>
          <div className="field"><label htmlFor="lb-phone">Phone number</label><input id="lb-phone" type="text" value={vals.phone} maxLength={40} onChange={(e) => setVals({ ...vals, phone: e.target.value })} /></div>
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

      <dialog ref={sureDlg} className="rs-dialog" aria-labelledby="lb-sure-title" onClose={() => setSure(null)} onMouseDown={(e) => { if (clickedOutside(e)) sureDlg.current?.close(); }}>
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
