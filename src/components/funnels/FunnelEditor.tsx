"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { addStep, deleteStep, moveStep, renameStep, saveStep } from "@/app/(app)/advertising/funnels/actions";
import { UndoRedo } from "@/components/UndoRedo";
import { ELEMENT_LABELS, ELEMENT_TYPES, emptyPage, type El, type ElementType, type Page, type Row } from "@/lib/funnels/types";
import { ElementView, css, fontHref, fontsOf } from "./render";
import { PageSettingsPanel, SettingsPanel } from "./Settings";
import { addElement, addRow, addSection, dropElement, duplicate, find, move, remove, setColumns, update, type Kind, type Sel } from "./tree";

export type EditorStep = { id: string; name: string; slug: string; position: number; page: Page };

const ICONS: Record<ElementType, string> = { headline: "H1", subheadline: "H2", text: "¶", image: "▣", video: "▶", button: "⬭", form: "✉", list: "☰", divider: "—", spacer: "↕" };

/** The funnel editor: pages of the funnel along the top, things to add on the left, the page in the middle, settings on the right. */
export function FunnelEditor({ funnel, steps: initial, userId, username }: { funnel: { id: string; name: string; slug: string }; steps: EditorStep[]; userId: string; username: string | null }) {
  const [steps, setSteps] = useState(initial);
  const [stepId, setStepId] = useState(initial[0]?.id ?? "");
  const step = steps.find((s) => s.id === stepId) ?? steps[0];
  const [page, setPage] = useState<Page>(step.page);
  const [past, setPast] = useState<Page[]>([]);
  const [future, setFuture] = useState<Page[]>([]);
  const [sel, setSel] = useState<Sel>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [status, setStatus] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<{ col: string; index: number } | null>(null);
  const saveTimer = useRef<number | null>(null);
  const latest = useRef({ page, stepId: step.id });

  /* ---------------------------------------------------------- saving: a moment after each change, and before leaving a page */
  const flush = useCallback(async () => {
    if (saveTimer.current) { window.clearTimeout(saveTimer.current); saveTimer.current = null; }
    const { page: p, stepId: id } = latest.current;
    setStatus("saving");
    const r = await saveStep(id, p);
    setStatus(r.ok ? "saved" : "error");
    if (!r.ok) setError(r.error ?? "We could not save.");
    else setSteps((list) => list.map((s) => (s.id === id ? { ...s, page: p } : s)));
  }, []);

  const change = useCallback((next: Page) => {
    const prev = latest.current.page;
    setPast((h) => [...h.slice(-49), prev]);
    setFuture([]);
    latest.current.page = next;
    setPage(next);
    setStatus("unsaved");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { void flush(); }, 1200);
  }, [flush]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (saveTimer.current) { e.preventDefault(); } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const undo = () => { const prev = past[past.length - 1]; if (!prev) return; const now = latest.current.page; setPast(past.slice(0, -1)); setFuture([now, ...future]); latest.current.page = prev; setPage(prev); setStatus("unsaved"); if (saveTimer.current) window.clearTimeout(saveTimer.current); saveTimer.current = window.setTimeout(() => { void flush(); }, 800); };
  const redo = () => { const next = future[0]; if (!next) return; const now = latest.current.page; setFuture(future.slice(1)); setPast([...past, now]); latest.current.page = next; setPage(next); setStatus("unsaved"); if (saveTimer.current) window.clearTimeout(saveTimer.current); saveTimer.current = window.setTimeout(() => { void flush(); }, 800); };

  async function openStep(id: string) {
    if (id === stepId) return;
    if (saveTimer.current) await flush();
    const s = steps.find((x) => x.id === id);
    if (!s) return;
    setStepId(id); latest.current = { page: s.page, stepId: id }; setPage(s.page); setPast([]); setFuture([]); setSel(null); setStatus("saved");
  }

  /* ---------------------------------------------------------- the chosen piece */
  const found = sel ? find(page, sel.id) : null;
  const choose = (kind: Kind, id: string) => (e: React.MouseEvent) => { e.stopPropagation(); setSel({ kind, id }); };
  const act = (fn: (p: Page) => { page: Page; id: string | null } | Page) => {
    const r = fn(page);
    if ("sections" in r) change(r);
    else { change(r.page); if (r.id) setSel((s) => (s ? { kind: s.kind, id: r.id! } : s)); }
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if ((e.key === "Delete" || e.key === "Backspace") && sel) { e.preventDefault(); change(remove(latest.current.page, sel.id)); setSel(null); }
      if (e.key === "Escape") setSel(null);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [sel, change]);

  /* ---------------------------------------------------------- pages of the funnel */
  const stepAction = (fn: () => Promise<{ ok: boolean; error?: string; id?: string; slug?: string }>, after?: (id?: string, slug?: string) => void) => start(async () => {
    if (saveTimer.current) await flush();
    const r = await fn();
    if (!r.ok) { setError(r.error ?? "Something went wrong."); return; }
    setError("");
    after?.(r.id, r.slug);
  });
  const moveLocal = (id: string, dir: -1 | 1) => setSteps((list) => {
    const l = [...list]; const i = l.findIndex((x) => x.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= l.length) return list;
    [l[i], l[j]] = [l[j], l[i]];
    return l.map((x, k) => ({ ...x, position: k }));
  });

  /* ---------------------------------------------------------- drawing the page with handles */
  const toolbar = (kind: Kind, id: string) => (
    <div className={`fe-bar fe-bar-${kind}`} onClick={(e) => e.stopPropagation()}>
      <span className="fe-bar-name">{kind === "element" && found?.kind === "element" ? ELEMENT_LABELS[found.item.type] : kind[0].toUpperCase() + kind.slice(1)}</span>
      {kind !== "column" ? <>
        <button type="button" title="Move up" aria-label="Move up" onClick={() => act((p) => move(p, id, -1))}>↑</button>
        <button type="button" title="Move down" aria-label="Move down" onClick={() => act((p) => move(p, id, 1))}>↓</button>
        <button type="button" title="Duplicate" aria-label="Duplicate" onClick={() => act((p) => duplicate(p, id))}>⧉</button>
      </> : null}
      <button type="button" title="Delete" aria-label="Delete" onClick={() => { change(remove(page, id)); setSel(null); }}>🗑</button>
    </div>
  );

  const elementBox = (el: El, colId: string, index: number) => {
    const on = sel?.id === el.id;
    return (
      <div
        key={el.id}
        className={"fe-el" + (on ? " on" : "") + (dragging === el.id ? " dragging" : "") + (dropAt?.col === colId && dropAt.index === index ? " drop-before" : "")}
        draggable
        onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData("text/fe-el", el.id); e.dataTransfer.effectAllowed = "move"; setDragging(el.id); }}
        onDragEnd={() => { setDragging(null); setDropAt(null); }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); const i = e.clientY < r.top + r.height / 2 ? index : index + 1; if (dropAt?.col !== colId || dropAt.index !== i) setDropAt({ col: colId, index: i }); }}
        onClick={choose("element", el.id)}
      >
        {on ? toolbar("element", el.id) : null}
        <div className="fe-el-inner"><ElementView el={el} links={{ next: null, step: () => "#", editing: true }} /></div>
      </div>
    );
  };

  const rowBox = (row: Row) => (
    <div key={row.id} className={"fe-row" + (sel?.id === row.id ? " on" : "")} style={css(row.style, "row")} onClick={choose("row", row.id)}>
      {sel?.id === row.id ? toolbar("row", row.id) : null}
      <div className="fe-cols-grid" style={{ gridTemplateColumns: device === "mobile" ? "1fr" : `repeat(${row.columns.length}, minmax(0, 1fr))` }}>
        {row.columns.map((c) => (
          <div key={c.id} className={"fe-col" + (sel?.id === c.id ? " on" : "") + (dropAt?.col === c.id && dropAt.index >= c.elements.length ? " drop-end" : "")} style={css(c.style, "column")} onClick={choose("column", c.id)}
            onDragOver={(e) => { e.preventDefault(); if (e.target === e.currentTarget) setDropAt({ col: c.id, index: c.elements.length }); }}
            onDrop={(e) => {
              e.preventDefault(); e.stopPropagation();
              const elId = e.dataTransfer.getData("text/fe-el");
              const newType = e.dataTransfer.getData("text/fe-new") as ElementType;
              const at = dropAt?.col === c.id ? dropAt.index : c.elements.length;
              if (elId) change(dropElement(page, elId, c.id, at));
              else if (ELEMENT_TYPES.includes(newType)) {
                const r = addElement(page, newType, { kind: "column", id: c.id });
                change(dropElement(r.page, r.id, c.id, at)); setSel({ kind: "element", id: r.id });
              }
              setDragging(null); setDropAt(null);
            }}>
            {sel?.id === c.id ? toolbar("column", c.id) : null}
            {c.elements.length === 0 ? <div className="fe-empty-col">Drop an element here</div> : null}
            {c.elements.map((el, i) => elementBox(el, c.id, i))}
          </div>
        ))}
      </div>
    </div>
  );

  const fonts = fontHref(fontsOf(page));
  const live = username ? `/f/${username}/${funnel.slug}/${step.slug}` : null;

  /* ---------------------------------------------------------- settings for what is chosen */
  const panel = (() => {
    if (!found) return <PageSettingsPanel settings={page.settings} set={(fn) => change({ ...page, settings: (() => { const s = { ...page.settings }; fn(s); return s; })() })} />;
    const id = found.item.id;
    return (
      <SettingsPanel
        key={id}
        kind={found.kind}
        el={found.kind === "element" ? found.item : undefined}
        style={found.item.style}
        columns={found.kind === "row" ? found.item.columns.length : undefined}
        steps={steps.map((s) => ({ slug: s.slug, name: s.name }))}
        userId={userId}
        setEl={(fn) => change(update(page, id, (it) => fn(it as El)))}
        setStyle={(fn) => change(update(page, id, (it) => fn(it.style)))}
        setColumns={found.kind === "row" ? (n) => change(setColumns(page, id, n)) : undefined}
      />
    );
  })();

  return (
    <div className="fe">
      {fonts ? <link rel="stylesheet" href={fonts} /> : null}
      <header className="fe-top">
        <Link href="/advertising/funnels" className="linkbtn">← Funnels</Link>
        <h1 className="fe-title" translate="no">{funnel.name}</h1>
        <div className="fe-top-right">
          <div className="fe-device" role="group" aria-label="Preview size">
            <button type="button" className={device === "desktop" ? "on" : ""} onClick={() => setDevice("desktop")}>Computer</button>
            <button type="button" className={device === "mobile" ? "on" : ""} onClick={() => setDevice("mobile")}>Phone</button>
          </div>
          <UndoRedo canUndo={past.length > 0} canRedo={future.length > 0} onUndo={undo} onRedo={redo} busy={pending} />
          <span className={"fe-status " + status} role="status">{status === "saved" ? "Saved ✓" : status === "saving" ? "Saving…" : status === "unsaved" ? "Unsaved changes" : "Not saved"}</span>
          <button type="button" className="btn small" disabled={status === "saved" || status === "saving"} onClick={() => void flush()}>Save</button>
          {live ? <a className="btn primary small" href={live} target="_blank" rel="noopener noreferrer">View live page</a> : null}
        </div>
      </header>

      <nav className="fe-steps" aria-label="Pages of this funnel">
        {steps.map((s, i) => (
          <div key={s.id} className={"fe-step" + (s.id === step.id ? " on" : "")}>
            <button type="button" className="fe-step-name" onClick={() => void openStep(s.id)} aria-current={s.id === step.id ? "page" : undefined}>
              <small>{i + 1}</small> <span translate="no">{s.name}</span>
            </button>
            {s.id === step.id ? (
              <span className="fe-step-tools">
                <button type="button" aria-label="Rename this page" title="Rename" onClick={() => { const n = window.prompt("New name for this page", s.name); if (n?.trim()) stepAction(() => renameStep(s.id, n), () => setSteps((l) => l.map((x) => (x.id === s.id ? { ...x, name: n.trim() } : x)))); }}>✎</button>
                <button type="button" aria-label="Move earlier" title="Move earlier" disabled={i === 0} onClick={() => stepAction(() => moveStep(s.id, -1), () => moveLocal(s.id, -1))}>←</button>
                <button type="button" aria-label="Move later" title="Move later" disabled={i === steps.length - 1} onClick={() => stepAction(() => moveStep(s.id, 1), () => moveLocal(s.id, 1))}>→</button>
                <button type="button" aria-label="Delete this page" title="Delete" disabled={steps.length <= 1} onClick={() => { if (window.confirm(`Delete the page "${s.name}"?`)) stepAction(() => deleteStep(s.id), () => { const other = steps.find((x) => x.id !== s.id); setSteps((l) => l.filter((x) => x.id !== s.id)); if (other) void openStep(other.id); }); }}>🗑</button>
              </span>
            ) : null}
          </div>
        ))}
        <button type="button" className="fe-step-add" disabled={pending} onClick={() => { const n = window.prompt("Name of the new page", `Page ${steps.length + 1}`); if (n?.trim()) stepAction(() => addStep(funnel.id, n), (id, slug) => { if (!id || !slug) return; setSteps((l) => [...l, { id, name: n.trim(), slug, position: l.length, page: emptyPage() }]); }); }}>+ Add a page</button>
      </nav>
      {error ? <p className="status bad fe-error" role="alert">{error}</p> : null}

      <div className="fe-body">
        <aside className="fe-add" aria-label="Add to the page">
          <h2 className="fe-panel-h">Add</h2>
          <button type="button" className="fe-add-btn wide" onClick={() => act((p) => { const r = addSection(p, sel); setSel({ kind: "section", id: r.id }); return r.page; })}>+ Section</button>
          <p className="fe-sub">Row</p>
          <div className="fe-add-rows">
            {[1, 2, 3, 4].map((n) => (
              <button key={n} type="button" className="fe-add-btn" onClick={() => act((p) => { const r = addRow(p, n, sel); setSel({ kind: "row", id: r.id }); return r.page; })} aria-label={`Row with ${n} columns`} title={`${n} column${n > 1 ? "s" : ""}`}>
                <span className="fe-mini-cols">{Array.from({ length: n }, (_, i) => <i key={i} />)}</span>
              </button>
            ))}
          </div>
          <p className="fe-sub">Elements</p>
          <p className="fe-hint">Click to add after what you chose, or drag onto the page.</p>
          <div className="fe-add-els">
            {ELEMENT_TYPES.map((t) => (
              <button key={t} type="button" className="fe-add-btn" draggable
                onDragStart={(e) => { e.dataTransfer.setData("text/fe-new", t); e.dataTransfer.effectAllowed = "copy"; }}
                onClick={() => act((p) => { const r = addElement(p, t, sel); setSel({ kind: "element", id: r.id }); return r.page; })}>
                <span className="fe-ico" aria-hidden="true">{ICONS[t]}</span>{ELEMENT_LABELS[t]}
              </button>
            ))}
          </div>
        </aside>

        <div className="fe-canvas-wrap" onClick={() => setSel(null)}>
          <div className={"fe-canvas " + device} style={{ background: page.settings.background, color: page.settings.color, fontFamily: page.settings.fontFamily ? `"${page.settings.fontFamily}", system-ui, sans-serif` : undefined }}>
            {page.sections.length === 0 ? <div className="fe-empty-page">This page is empty. Add a section from the left to begin.</div> : null}
            {page.sections.map((s) => (
              <section key={s.id} className={"fe-section" + (sel?.id === s.id ? " on" : "")} style={css(s.style, "section")} onClick={choose("section", s.id)}>
                {sel?.id === s.id ? toolbar("section", s.id) : null}
                {s.rows.length === 0 ? <div className="fe-empty-col">Add a row to this section</div> : null}
                {s.rows.map((r) => rowBox(r))}
              </section>
            ))}
          </div>
        </div>

        <aside className="fe-settings" aria-label="Settings">{panel}</aside>
      </div>
    </div>
  );
}
