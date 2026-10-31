"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteItem, ensureFolder, getFileLinks, getSourceLink, moveItem, registerFile, renameItem, setFileAccess, setFolderAccess, setThumb } from "@/app/(app)/documents/actions";
import { createClient } from "@/lib/supabase/client";
import { BulkDialog, type Picked } from "./BulkDialog";
import { makeThumb } from "@/lib/documents/thumbs";
import { MAX_FILE_BYTES, MAX_UPLOAD_MB, isOfficeDoc, isViewable, mimeFor, safeName, sizeLabel, type DocFile, type DocFolder } from "@/lib/documents/types";
import { PdfPages } from "./PdfPages";
import { TextPreview } from "./TextPreview";
import type { Role } from "@/lib/roles";

type Item = { kind: "folder"; f: DocFolder } | { kind: "file"; f: DocFile };

function Tag({ children }: { children: React.ReactNode }) { return <span className="doc-tag">{children}</span>; }

/** The drive: folders and files, a viewer, and (for admins) upload, import, rename, move, visibility and delete. */
const VIEW_KEY = "flc_docs_view";
const subscribeView = (cb: () => void) => { window.addEventListener("flc:docsview", cb); return () => window.removeEventListener("flc:docsview", cb); };
const readView = (): "grid" | "list" => { try { return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid"; } catch { return "grid"; } };

function Cover({ f, url }: { f: DocFile; url?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  if (url) return <img className="doc-cover" src={url} alt="" loading="lazy" draggable={false} />;
  const ext = f.name.includes(".") ? f.name.split(".").pop()!.slice(0, 4).toUpperCase() : "FILE";
  const icon = f.mime.startsWith("audio/") ? "🎧" : f.mime.startsWith("video/") ? "🎬" : f.mime.includes("sheet") || f.mime.includes("excel") ? "📊" : f.mime.includes("presentation") || f.mime.includes("powerpoint") ? "📽️" : f.mime === "application/pdf" ? "📕" : "📄";
  return <span className="doc-cover fallback"><span aria-hidden="true">{icon}</span><b>{ext}</b></span>;
}

export function DocBrowser({ folderId, trail, folders, files, thumbUrls, allFolders, manage, basePath, role }: {
  folderId: string | null; trail: DocFolder[]; folders: DocFolder[]; files: DocFile[]; thumbUrls: Record<string, string>; allFolders: DocFolder[];
  /** true on the Update Documents page: shows the add / rename / move / visibility / delete controls */
  manage: boolean;
  /** where folder links go, so each page stays on itself */
  basePath: string;
  role: Role;
}) {
  const isAdmin = manage;
  const layout = useSyncExternalStore(subscribeView, readView, () => "grid" as const);
  const setLayout = (v: "grid" | "list") => { try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ } window.dispatchEvent(new Event("flc:docsview")); };
  const router = useRouter();
  const [pending, start] = useTransition();
  const viewer = useRef<HTMLDialogElement>(null);
  const editor = useRef<HTMLDialogElement>(null);
  const pdfGo = useRef<((n: number) => void) | null>(null);
  const [pager, setPager] = useState<{ page: number; pages: number } | null>(null);
  const [view, setView] = useState<{ name: string; mime: string; view?: string; download?: string; error?: string } | null>(null);
  const [edit, setEdit] = useState<Item | null>(null);
  const [msg, setMsg] = useState("");
  const [progress, setProgress] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [skipped, setSkipped] = useState<{ name: string; size: number; why: string }[]>([]);
  /* selection (Update Documents only): click, ctrl/cmd-click, tick boxes, or drag a box around items */
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [bulk, setBulk] = useState<"move" | "copy" | "delete" | null>(null);
  const area = useRef<HTMLDivElement>(null);
  const bulkDlg = useRef<HTMLDialogElement>(null);
  const lastPointer = useRef("mouse");
  const dragged = useRef(false);
  const k = (kind: "folder" | "file", id: string) => `${kind}:${id}`;
  const picked: Picked[] = [...folders.map((f) => ({ kind: "folder" as const, id: f.id, name: f.name })), ...files.map((f) => ({ kind: "file" as const, id: f.id, name: f.name }))].filter((i) => sel.has(k(i.kind, i.id)));
  const toggle = (key: string) => setSel((cur) => { const n = new Set(cur); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  useEffect(() => {
    if (!manage) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !bulkDlg.current?.open) setSel(new Set()); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [manage]);

  const selRef = useRef(sel);
  useEffect(() => { selRef.current = sel; });

  /* The drag-a-box selection listens on the whole page area (not just the list), so you can start from any empty space. */
  useEffect(() => {
    if (!manage) return;
    const main: HTMLElement = document.body;
    const onDown = (e: PointerEvent) => {
      lastPointer.current = e.pointerType;
      dragged.current = false;
      const t = e.target as HTMLElement;
      if (e.button !== 0 || e.pointerType === "touch" || t.closest(".doc-more, .doc-check, dialog")) return;
      const onItem = !!t.closest("[data-sel]");
      if (!onItem && t.closest("button, a, input, select, textarea, label, [role=toolbar], [role=menu], .doc-tools, .doc-view-toggle, .doc-progress, .doc-skipped, .tour")) return;
      const host = area.current; if (!host) return;
      if (!onItem) e.preventDefault(); // no text selection while dragging a box over empty space
      const sx = e.clientX + window.scrollX, sy = e.clientY + window.scrollY;
      const additive = e.metaKey || e.ctrlKey || e.shiftKey;
      const base = additive ? new Set(selRef.current) : new Set<string>();
      let moved = false;
      const move = (ev: PointerEvent) => {
        const cx = ev.clientX + window.scrollX, cy = ev.clientY + window.scrollY;
        if (!moved && Math.hypot(cx - sx, cy - sy) < (onItem ? 12 : 6)) return;
        if (!moved) document.body.classList.add("doc-dragging");
        moved = true; dragged.current = true;
        const x1 = Math.min(sx, cx), x2 = Math.max(sx, cx), y1 = Math.min(sy, cy), y2 = Math.max(sy, cy);
        setBox({ x: x1 - window.scrollX, y: y1 - window.scrollY, w: x2 - x1, h: y2 - y1 });
        const hit = new Set(base);
        host.querySelectorAll<HTMLElement>("[data-sel]").forEach((el) => { const r = el.getBoundingClientRect(); const l = r.left + window.scrollX, tp = r.top + window.scrollY; if (l < x2 && l + r.width > x1 && tp < y2 && tp + r.height > y1) hit.add(el.dataset.sel!); });
        setSel(hit);
      };
      const up = () => {
        window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
        setBox(null); document.body.classList.remove("doc-dragging");
        if (!moved && !onItem && !additive) setSel(new Set());
      };
      window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
    };
    main.addEventListener("pointerdown", onDown);
    return () => main.removeEventListener("pointerdown", onDown);
  }, [manage]);

  /** A click opens a folder or document. Hold Ctrl/Cmd/Shift to add it to the selection instead. */
  function itemClick(e: React.MouseEvent, key: string, openIt: () => void) {
    if (!manage) return openIt();
    if (dragged.current) { e.preventDefault(); dragged.current = false; return; }
    if (e.metaKey || e.ctrlKey || e.shiftKey) { e.preventDefault(); toggle(key); return; }
    openIt();
  }

  const fileInput = useRef<HTMLInputElement>(null);
  const zipInput = useRef<HTMLInputElement>(null);

  async function open(f: DocFile) {
    setPager(null);
    setView({ name: f.name, mime: f.mime });
    viewer.current?.showModal();
    const r = await getFileLinks(f.id);
    setView(r.ok ? { name: r.name ?? f.name, mime: r.mime ?? f.mime, view: r.view, download: r.download } : { name: f.name, mime: f.mime, error: r.error });
  }

  function newFolder() {
    const name = window.prompt("Folder name");
    if (!name) return;
    start(async () => { const r = await ensureFolder(folderId, name); if (!r.ok) setMsg(r.error ?? "That did not work."); else router.refresh(); });
  }

  const log = (line: string) => setProgress((p) => [...p.slice(-6), line]);

  async function upload(list: File[], at: string | null, relFolders?: Map<File, string[]>) {
    const supabase = createClient();
    const cache = new Map<string, string | null>([["", at]]);
    const folderFor = async (parts: string[]): Promise<string | null> => {
      let key = "", parent = at;
      for (const part of parts) {
        key += "/" + part;
        if (!cache.has(key)) { const r = await ensureFolder(parent, part); if (!r.ok || !r.id) throw new Error(r.error ?? "Could not create a folder."); cache.set(key, r.id); }
        parent = cache.get(key) ?? null;
      }
      return parent;
    };
    let done = 0, failed = 0;
    const notAdded: { name: string; size: number; why: string }[] = [];
    for (const f of list) {
      try {
        if (f.size > MAX_FILE_BYTES) throw new Error(`over ${MAX_UPLOAD_MB} MB`);
        const where = await folderFor(relFolders?.get(f) ?? []);
        const mime = f.type || mimeFor(f.name);
        const path = `${crypto.randomUUID()}/${safeName(f.name)}`;
        const { error } = await supabase.storage.from("documents").upload(path, f, { contentType: mime });
        if (error) throw new Error(error.message);
        let thumbPath: string | null = null;
        const tb = await makeThumb(f, mime);
        if (tb) { const tp = `thumbs/${crypto.randomUUID()}.jpg`; const up = await supabase.storage.from("documents").upload(tp, tb, { contentType: "image/jpeg" }); if (!up.error) thumbPath = tp; }
        const r = await registerFile({ folderId: where, path, name: f.name, mime, size: f.size, thumbPath });
        if (!r.ok) throw new Error(r.error ?? "not saved");
        done++; log(`Added ${f.name} (${done}/${list.length})`);
      } catch (e) { failed++; const why = e instanceof Error ? e.message : "error"; notAdded.push({ name: f.name, size: f.size, why }); log(`Could not add ${f.name}: ${why}`); }
    }
    setSkipped((cur) => [...cur, ...notAdded]);
    return { done, failed };
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setProgress([]); setMsg(""); setSkipped([]);
    const r = await upload([...files], folderId);
    setBusy(false); setMsg(`${r.done} added${r.failed ? `, ${r.failed} could not be added` : ""}.`); router.refresh();
  }

  async function onZip(files: FileList | null) {
    const zip = files?.[0];
    if (!zip) return;
    setBusy(true); setProgress([]); setMsg(""); setSkipped([]);
    try {
      const { unzipSync } = await import("fflate");
      log("Opening the zip…");
      const data = unzipSync(new Uint8Array(await zip.arrayBuffer()), { filter: (f) => !f.name.endsWith("/") && !/(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db)/.test(f.name) });
      const list: File[] = [], rel = new Map<File, string[]>();
      for (const [path, bytes] of Object.entries(data)) {
        const parts = path.split("/").filter(Boolean);
        const name = parts.pop()!;
        const file = new File([bytes as BlobPart], name, { type: mimeFor(name) });
        list.push(file); rel.set(file, parts);
      }
      log(`Found ${list.length} files. Adding them now…`);
      const r = await upload(list, folderId, rel);
      setMsg(`${r.done} added${r.failed ? `, ${r.failed} could not be added` : ""}. Everything was added for paying members only. Open a folder to switch it on for leads.`);
    } catch { setMsg("We could not read that zip file. Try downloading the folder from Google Drive again."); }
    setBusy(false); router.refresh();
  }

  const missing = files.filter((f) => !f.thumb_path && (f.mime.startsWith("image/") || f.mime === "application/pdf" || f.mime.startsWith("video/")) && f.size_bytes < 30 * 1048576);
  async function makePreviews() {
    setBusy(true); setProgress([]); setMsg("");
    const supabase = createClient();
    let made = 0;
    for (const f of missing) {
      try {
        const src = await getSourceLink(f.id);
        if (!src.ok || !src.url) continue;
        const blob = await (await fetch(src.url)).blob();
        const tb = await makeThumb(blob, f.mime);
        if (!tb) continue;
        const tp = `thumbs/${crypto.randomUUID()}.jpg`;
        const up = await supabase.storage.from("documents").upload(tp, tb, { contentType: "image/jpeg" });
        if (!up.error && (await setThumb(f.id, tp)).ok) { made++; log(`Made a preview for ${f.name}`); }
      } catch { log(`No preview for ${f.name}`); }
    }
    setBusy(false); setMsg(`${made} preview${made === 1 ? "" : "s"} made.`); router.refresh();
  }

  const itemsEmpty = folders.length === 0 && files.length === 0;
  return (
    <div className="docs">
      {folderId ? (
        <p style={{ margin: "0 0 10px" }}>
          <Link className="doc-back" href={trail.length > 1 ? `${basePath}?f=${trail[trail.length - 2].id}` : basePath}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
            Back
          </Link>
        </p>
      ) : null}
      <nav className="crumbs" aria-label="Folder path">
        <Link href={basePath}>{manage ? "Update Documents" : "Documents"}</Link>
        {trail.map((t) => <span key={t.id}> / <Link href={`${basePath}?f=${t.id}`}>{t.name}</Link></span>)}
      </nav>

      <div className="doc-view-toggle" role="group" aria-label="Layout">
        <button type="button" className={layout === "grid" ? "on" : ""} aria-pressed={layout === "grid"} onClick={() => setLayout("grid")}>Icons</button>
        <button type="button" className={layout === "list" ? "on" : ""} aria-pressed={layout === "list"} onClick={() => setLayout("list")}>List</button>
      </div>
      {isAdmin ? (
        <div className="doc-tools">
          <button className="btn small" type="button" disabled={pending || busy} onClick={newFolder}>New folder</button>
          <button className="btn small primary" type="button" disabled={busy} onClick={() => fileInput.current?.click()}>Upload files</button>
          <button className="btn small" type="button" disabled={busy} onClick={() => zipInput.current?.click()}>Import a zip (Google Drive)</button>
          <input ref={fileInput} type="file" multiple hidden onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }} />
          <input ref={zipInput} type="file" accept=".zip,application/zip" hidden onChange={(e) => { void onZip(e.target.files); e.target.value = ""; }} />
          {missing.length ? <button className="btn small" type="button" disabled={busy} onClick={makePreviews}>Make previews ({missing.length})</button> : null}
          <span className="admin-only-note">Admins Only</span>
        </div>
      ) : null}
      {progress.length ? <ul className="doc-progress" aria-live="polite">{progress.map((p, i) => <li key={i}>{p}</li>)}</ul> : null}
      <p role="status" className="when">{msg}</p>
      {skipped.length ? (
        <section className="card-s doc-skipped" aria-label="Files that were not added">
          <h2 className="qh" style={{ margin: "0 0 6px", fontSize: 18 }}>Not added ({skipped.length})</h2>
          <p className="when" style={{ margin: "0 0 8px" }}>
            {skipped.some((x) => x.why.startsWith("over")) ? `Files over ${MAX_UPLOAD_MB} MB can't be uploaded yet. Shrink them (for PDFs, try a free "compress PDF" tool), or keep them as a link and tell me, and I'll add links to the portal.` : "These could not be added. You can try them again."}
          </p>
          <ul>{skipped.map((x, i) => <li key={i}>{x.name} <span className="when">({sizeLabel(x.size)}, {x.why})</span></li>)}</ul>
          <button type="button" className="linkbtn" style={{ padding: 0 }} onClick={() => { void navigator.clipboard?.writeText(skipped.map((x) => `${x.name} (${sizeLabel(x.size)}, ${x.why})`).join("\n")); }}>Copy this list</button>
        </section>
      ) : null}

      {manage ? <div className="doc-selslot">
      {sel.size ? (
        <div className="doc-selbar" role="toolbar" aria-label="Selected items">
          <strong>{sel.size} selected</strong>
          <button className="btn small" type="button" onClick={() => { setBulk("move"); bulkDlg.current?.showModal(); }}>Move</button>
          <button className="btn small" type="button" onClick={() => { setBulk("copy"); bulkDlg.current?.showModal(); }}>Copy</button>
          <button className="btn small danger-btn" type="button" onClick={() => { setBulk("delete"); bulkDlg.current?.showModal(); }}>Delete</button>
          <button className="linkbtn" type="button" onClick={() => setSel(new Set())}>Clear</button>
        </div>
      ) : !itemsEmpty ? <p className="when" style={{ margin: 0, paddingTop: 14 }}>Tip: click and drag anywhere on the page to select several items at once.</p> : null}
      </div> : null}
      <div ref={area} className={"doc-area" + (manage ? " selectable" : "") + (sel.size ? " has-sel" : "")} onDragStart={(e) => e.preventDefault()}>
      {itemsEmpty ? <section className="card-s">
          <p style={{ margin: 0 }}>{isAdmin ? "This folder is empty. Add a folder or upload files." : "Nothing here yet."}</p>
          {isAdmin && folderId ? (
            <p style={{ margin: "14px 0 0" }}>
              <button type="button" className="btn small danger-btn" disabled={pending} onClick={() => { if (window.confirm("Delete this empty folder?")) start(async () => { const r = await deleteItem("folder", folderId); if (!r.ok) setMsg(r.error ?? "That did not work."); else router.push(trail.length > 1 ? `${basePath}?f=${trail[trail.length - 2].id}` : basePath); }); }}>Delete this folder</button>
            </p>
          ) : null}
        </section> : layout === "grid" ? (
        <ul className="doc-grid">
          {folders.map((f) => (
            <li key={f.id} className={"doc-card" + (sel.has(k("folder", f.id)) ? " selected" : "")} data-sel={manage ? k("folder", f.id) : undefined}>
              {manage ? <input type="checkbox" className="doc-check" aria-label={`Select ${f.name}`} checked={sel.has(k("folder", f.id))} onChange={() => toggle(k("folder", f.id))} /> : null}
              <Link href={`${basePath}?f=${f.id}`} className="doc-card-main" onClick={(e) => itemClick(e, k("folder", f.id), () => {})} draggable={false}>
                <span className="doc-cover folder" aria-hidden="true">📁</span>
                <span className="doc-card-name">{f.name}</span>
                {isAdmin && (f.for_leads || f.for_downline) ? <span className="doc-tags">{f.for_leads ? <Tag>Leads</Tag> : null}{f.for_downline ? <Tag>Downline</Tag> : null}</span> : null}
              </Link>
              {isAdmin ? <button className="doc-more over" type="button" aria-label={`Options for ${f.name}`} onClick={() => { setEdit({ kind: "folder", f }); editor.current?.showModal(); }}>⋯</button> : null}
            </li>
          ))}
          {files.map((f) => (
            <li key={f.id} className={"doc-card" + (sel.has(k("file", f.id)) ? " selected" : "")} data-sel={manage ? k("file", f.id) : undefined}>
              {manage ? <input type="checkbox" className="doc-check" aria-label={`Select ${f.name}`} checked={sel.has(k("file", f.id))} onChange={() => toggle(k("file", f.id))} /> : null}
              <button type="button" className="doc-card-main" onClick={(e) => itemClick(e, k("file", f.id), () => open(f))}>
                <Cover f={f} url={thumbUrls[f.id]} />
                <span className="doc-card-name">{f.name}</span>
                <span className="doc-tags">
                  {!f.downloadable ? <Tag>View only</Tag> : null}
                  {isAdmin && f.for_leads ? <Tag>Leads</Tag> : null}{isAdmin && f.for_downline ? <Tag>Downline</Tag> : null}
                </span>
              </button>
              {isAdmin ? <button className="doc-more over" type="button" aria-label={`Options for ${f.name}`} onClick={() => { setEdit({ kind: "file", f }); editor.current?.showModal(); }}>⋯</button> : null}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="doc-list">
          {folders.map((f) => (
            <li key={f.id} className={"" + (sel.has(k("folder", f.id)) ? " selected" : "")} data-sel={manage ? k("folder", f.id) : undefined}>
              {manage ? <input type="checkbox" className="doc-check" aria-label={`Select ${f.name}`} checked={sel.has(k("folder", f.id))} onChange={() => toggle(k("folder", f.id))} /> : null}
              <Link href={`${basePath}?f=${f.id}`} className="doc-row" onClick={(e) => itemClick(e, k("folder", f.id), () => {})} draggable={false}>
                <span className="doc-ico" aria-hidden="true">📁</span>
                <span className="doc-name">{f.name}</span>
                {isAdmin ? <span className="doc-tags">{f.for_leads ? <Tag>Leads</Tag> : null}{f.for_downline ? <Tag>Lacey&apos;s downline</Tag> : null}</span> : null}
              </Link>
              {isAdmin ? <button className="doc-more" type="button" aria-label={`Options for ${f.name}`} onClick={() => { setEdit({ kind: "folder", f }); editor.current?.showModal(); }}>⋯</button> : null}
            </li>
          ))}
          {files.map((f) => (
            <li key={f.id} className={"" + (sel.has(k("file", f.id)) ? " selected" : "")} data-sel={manage ? k("file", f.id) : undefined}>
              {manage ? <input type="checkbox" className="doc-check" aria-label={`Select ${f.name}`} checked={sel.has(k("file", f.id))} onChange={() => toggle(k("file", f.id))} /> : null}
              <button type="button" className="doc-row" onClick={(e) => itemClick(e, k("file", f.id), () => open(f))}>
                <span className="doc-ico" aria-hidden="true">{f.mime.startsWith("image/") ? "🖼️" : f.mime.startsWith("video/") ? "🎬" : f.mime.startsWith("audio/") ? "🎧" : f.mime === "application/pdf" ? "📕" : "📄"}</span>
                <span className="doc-name">{f.name}</span>
                <span className="doc-tags">
                  {!f.downloadable ? <Tag>View only</Tag> : null}
                  {isAdmin && f.for_leads ? <Tag>Leads</Tag> : null}{isAdmin && f.for_downline ? <Tag>Lacey&apos;s downline</Tag> : null}
                  <span className="when">{sizeLabel(f.size_bytes)}</span>
                </span>
              </button>
              {isAdmin ? <button className="doc-more" type="button" aria-label={`Options for ${f.name}`} onClick={() => { setEdit({ kind: "file", f }); editor.current?.showModal(); }}>⋯</button> : null}
            </li>
          ))}
        </ul>
      )}
      </div>
      {box ? <div className="doc-marquee" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} aria-hidden="true" /> : null}
      {role === "lead" ? <p className="when" style={{ marginTop: 18 }}>More documents unlock when you join the Free Life Collective as an affiliate.</p> : null}

      <dialog ref={viewer} className="rs-dialog doc-viewer" aria-labelledby="dv-title" onClose={() => { setView(null); setPager(null); }}
        onKeyDown={(e) => { if (view?.mime !== "application/pdf" || !pager) return; if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); pdfGo.current?.(pager.page + 1); } else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); pdfGo.current?.(pager.page - 1); } }}>
        <h2 id="dv-title" className="qh" style={{ marginTop: 0, overflowWrap: "anywhere" }}>{view?.name}</h2>
        {view?.error ? <p className="err">{view.error}</p> : !view?.view && !view?.download ? <p className="when">Loading…</p> : null}
        {view?.view && view.mime === "application/pdf" ? <PdfPages url={view.view} title={view.name} goRef={pdfGo} onPage={(page, pages) => setPager({ page, pages })} /> : null}
        {view?.view && view.mime.startsWith("image/") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="doc-img" src={view.view} alt={view.name} />
        ) : null}
        {view?.view && view.mime.startsWith("video/") ? <video className="doc-img" src={view.view} controls controlsList={view.download ? undefined : "nodownload"} /> : null}
        {view?.view && view.mime.startsWith("audio/") ? <audio src={view.view} controls controlsList={view.download ? undefined : "nodownload"} style={{ width: "100%" }} /> : null}
        {view?.view && (view.mime === "text/plain" || view.mime === "text/csv") ? <TextPreview url={view.view} /> : null}
        {view?.view && isOfficeDoc(view.mime) ? (
          <>
            <iframe className="doc-frame" src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(view.view)}`} title={view.name} />
            <p className="when" style={{ margin: "6px 0 0" }}>Shown with Microsoft&rsquo;s free viewer. The layout can differ a little from the original, and very large files may not load. Download it to open it fully.</p>
          </>
        ) : null}
        {view && !view.view && view.download ? <p className="when">This type of file cannot be previewed here. Use the Download button to open it on your device.</p> : null}
        <div className="dlg-actions">
          {view?.mime === "application/pdf" && pager && pager.pages > 1 ? (
            <div className="pdf-pager" role="group" aria-label="Pages">
              <button type="button" className="pdf-arrow" aria-label="Previous page" disabled={pager.page <= 1} onClick={() => pdfGo.current?.(pager.page - 1)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></button>
              <span className="when" aria-live="polite">Page {pager.page} of {pager.pages}</span>
              <button type="button" className="pdf-arrow" aria-label="Next page" disabled={pager.page >= pager.pages} onClick={() => pdfGo.current?.(pager.page + 1)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg></button>
            </div>
          ) : null}
          {!view?.download && view?.view ? <span className="when" style={{ marginRight: "auto" }}>View only</span> : null}
          <button className="btn" type="button" onClick={() => viewer.current?.close()}>Close</button>
          {view?.download ? <a className="btn primary" href={view.download} style={{ textDecoration: "none" }}>Download</a> : null}
        </div>
      </dialog>

      <dialog ref={bulkDlg} className="rs-dialog" aria-labelledby="bulk-title" onClose={() => setBulk(null)}>
        {bulk ? <BulkDialog key={bulk + picked.length} mode={bulk} items={picked} folders={allFolders} currentFolder={folderId} onClose={() => bulkDlg.current?.close()} onDone={() => { bulkDlg.current?.close(); setSel(new Set()); router.refresh(); }} /> : null}
      </dialog>

      <dialog ref={editor} className="rs-dialog" aria-labelledby="de-title" onClose={() => setEdit(null)}>
        {edit ? <ItemSettings key={`${edit.kind}-${edit.f.id}`} item={edit} folders={allFolders} onDone={() => { editor.current?.close(); router.refresh(); }} /> : null}
      </dialog>
    </div>
  );
}

function ItemSettings({ item, folders, onDone }: { item: Item; folders: DocFolder[]; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [name, setName] = useState(item.f.name);
  const [leads, setLeads] = useState(item.f.for_leads);
  const [downline, setDownline] = useState(item.f.for_downline);
  const [downloadable, setDownloadable] = useState(item.kind === "file" ? item.f.downloadable : true);
  const [cascade, setCascade] = useState(true);
  const [to, setTo] = useState<string>((item.kind === "folder" ? item.f.parent_id : item.f.folder_id) ?? "");
  const [error, setError] = useState("");
  const here = (item.kind === "folder" ? item.f.parent_id : item.f.folder_id) ?? "";

  // a folder cannot be moved into itself or anything inside it
  const inside = new Set<string>();
  if (item.kind === "folder") { inside.add(item.f.id); for (let grew = true; grew; ) { grew = false; for (const f of folders) if (f.parent_id && inside.has(f.parent_id) && !inside.has(f.id)) { inside.add(f.id); grew = true; } } }
  const path = (id: string): string => { const f = folders.find((x) => x.id === id); return f ? (f.parent_id ? path(f.parent_id) + " / " : "") + f.name : ""; };

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { setError(""); const r = await fn(); if (!r.ok) setError(r.error ?? "That did not work."); else onDone(); });
  function save() {
    run(async () => {
      if (name.trim() !== item.f.name) { const r = await renameItem(item.kind, item.f.id, name); if (!r.ok) return r; }
      if (to !== here) { const r = await moveItem(item.kind, item.f.id, to || null); if (!r.ok) return r; }
      return item.kind === "folder" ? setFolderAccess(item.f.id, leads, downline, cascade) : setFileAccess(item.f.id, leads, downline, downloadable);
    });
  }
  const canViewOnly = item.kind === "file" && isViewable(item.f.mime);

  return (
    <div>
      <h2 id="de-title" className="qh" style={{ marginTop: 0 }}>{item.kind === "folder" ? "Folder options" : "Document options"}</h2>
      <div className="field"><label htmlFor="di-name">Name</label><input id="di-name" type="text" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} /></div>
      <fieldset className="offer-pick" style={{ marginTop: 14, gridTemplateColumns: "1fr" }}>
        <legend>Who can see it (paying affiliates always can)</legend>
        <label className="check"><input type="checkbox" checked={leads} onChange={(e) => setLeads(e.target.checked)} /> Leads</label>
        <label className="check"><input type="checkbox" checked={downline} onChange={(e) => setDownline(e.target.checked)} /> Lacey&apos;s downline</label>
        {item.kind === "folder" ? <label className="check"><input type="checkbox" checked={cascade} onChange={(e) => setCascade(e.target.checked)} /> Apply this to everything inside the folder too</label> : null}
      </fieldset>
      {item.kind === "file" ? (
        <label className="check" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={downloadable} disabled={!canViewOnly} onChange={(e) => setDownloadable(e.target.checked)} /> People can download this
          {!canViewOnly ? <span className="when"> (this file type must stay downloadable)</span> : null}
        </label>
      ) : null}
      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="di-move">Move to</label>
        <select id="di-move" value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">Top level</option>
          {folders.filter((f) => !inside.has(f.id)).map((f) => <option key={f.id} value={f.id}>{path(f.id)}</option>)}
        </select>
      </div>
      {item.kind === "file" && !downloadable ? <p className="when" style={{ margin: "10px 0 0" }}>View-only hides the Download button. People can still view it in the portal, but it cannot be fully locked against someone determined to save it.</p> : null}
      <p className="err" role="alert">{error}</p>
      <div className="dlg-actions">
        <button className="linkbtn danger" type="button" disabled={pending} style={{ marginRight: "auto" }} onClick={() => { if (window.confirm(item.kind === "folder" ? "Delete this folder and everything inside it?" : "Delete this document?")) run(() => deleteItem(item.kind, item.f.id)); }}>Delete</button>
        <button className="btn" type="button" onClick={onDone}>Cancel</button>
        <button className="btn primary" type="button" disabled={pending} onClick={save}>Save</button>
      </div>
    </div>
  );
}
