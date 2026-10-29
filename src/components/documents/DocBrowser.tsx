"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteItem, ensureFolder, getFileLinks, moveItem, registerFile, renameItem, setFileAccess, setFolderAccess } from "@/app/(app)/documents/actions";
import { createClient } from "@/lib/supabase/client";
import { MAX_FILE_BYTES, isViewable, mimeFor, safeName, sizeLabel, type DocFile, type DocFolder } from "@/lib/documents/types";
import type { Role } from "@/lib/roles";

type Item = { kind: "folder"; f: DocFolder } | { kind: "file"; f: DocFile };

function Tag({ children }: { children: React.ReactNode }) { return <span className="doc-tag">{children}</span>; }

/** The drive: folders and files, a viewer, and (for admins) upload, import, rename, move, visibility and delete. */
export function DocBrowser({ folderId, trail, folders, files, allFolders, isAdmin, role }: {
  folderId: string | null; trail: DocFolder[]; folders: DocFolder[]; files: DocFile[]; allFolders: DocFolder[]; isAdmin: boolean; role: Role;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const viewer = useRef<HTMLDialogElement>(null);
  const editor = useRef<HTMLDialogElement>(null);
  const [view, setView] = useState<{ name: string; mime: string; view?: string; download?: string; error?: string } | null>(null);
  const [edit, setEdit] = useState<Item | null>(null);
  const [msg, setMsg] = useState("");
  const [progress, setProgress] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const zipInput = useRef<HTMLInputElement>(null);

  async function open(f: DocFile) {
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
    for (const f of list) {
      try {
        if (f.size > MAX_FILE_BYTES) throw new Error("over 50 MB");
        const where = await folderFor(relFolders?.get(f) ?? []);
        const mime = f.type || mimeFor(f.name);
        const path = `${crypto.randomUUID()}/${safeName(f.name)}`;
        const { error } = await supabase.storage.from("documents").upload(path, f, { contentType: mime });
        if (error) throw new Error(error.message);
        const r = await registerFile({ folderId: where, path, name: f.name, mime, size: f.size });
        if (!r.ok) throw new Error(r.error ?? "not saved");
        done++; log(`Added ${f.name} (${done}/${list.length})`);
      } catch (e) { failed++; log(`Could not add ${f.name}: ${e instanceof Error ? e.message : "error"}`); }
    }
    return { done, failed };
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setProgress([]); setMsg("");
    const r = await upload([...files], folderId);
    setBusy(false); setMsg(`${r.done} added${r.failed ? `, ${r.failed} could not be added` : ""}.`); router.refresh();
  }

  async function onZip(files: FileList | null) {
    const zip = files?.[0];
    if (!zip) return;
    setBusy(true); setProgress([]); setMsg("");
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

  const itemsEmpty = folders.length === 0 && files.length === 0;
  return (
    <div className="docs">
      <nav className="crumbs" aria-label="Folder path">
        <Link href="/documents">Documents</Link>
        {trail.map((t) => <span key={t.id}> / <Link href={`/documents?f=${t.id}`}>{t.name}</Link></span>)}
      </nav>

      {isAdmin ? (
        <div className="doc-tools">
          <button className="btn small" type="button" disabled={pending || busy} onClick={newFolder}>New folder</button>
          <button className="btn small primary" type="button" disabled={busy} onClick={() => fileInput.current?.click()}>Upload files</button>
          <button className="btn small" type="button" disabled={busy} onClick={() => zipInput.current?.click()}>Import a zip (Google Drive)</button>
          <input ref={fileInput} type="file" multiple hidden onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }} />
          <input ref={zipInput} type="file" accept=".zip,application/zip" hidden onChange={(e) => { void onZip(e.target.files); e.target.value = ""; }} />
          <span className="admin-only-note">Admins Only</span>
        </div>
      ) : null}
      {progress.length ? <ul className="doc-progress" aria-live="polite">{progress.map((p, i) => <li key={i}>{p}</li>)}</ul> : null}
      <p role="status" className="when">{msg}</p>

      {itemsEmpty ? <section className="card-s"><p style={{ margin: 0 }}>{isAdmin ? "This folder is empty. Add a folder or upload files." : "Nothing here yet."}</p></section> : (
        <ul className="doc-list">
          {folders.map((f) => (
            <li key={f.id}>
              <Link href={`/documents?f=${f.id}`} className="doc-row">
                <span className="doc-ico" aria-hidden="true">📁</span>
                <span className="doc-name">{f.name}</span>
                {isAdmin ? <span className="doc-tags">{f.for_leads ? <Tag>Leads</Tag> : null}{f.for_downline ? <Tag>Lacey&apos;s downline</Tag> : null}</span> : null}
              </Link>
              {isAdmin ? <button className="doc-more" type="button" aria-label={`Options for ${f.name}`} onClick={() => { setEdit({ kind: "folder", f }); editor.current?.showModal(); }}>⋯</button> : null}
            </li>
          ))}
          {files.map((f) => (
            <li key={f.id}>
              <button type="button" className="doc-row" onClick={() => open(f)}>
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
      {role === "lead" ? <p className="when" style={{ marginTop: 18 }}>More documents unlock when you join the Free Life Collective as an affiliate.</p> : null}

      <dialog ref={viewer} className="rs-dialog doc-viewer" aria-labelledby="dv-title" onClose={() => setView(null)}>
        <h2 id="dv-title" className="qh" style={{ marginTop: 0, overflowWrap: "anywhere" }}>{view?.name}</h2>
        {view?.error ? <p className="err">{view.error}</p> : !view?.view && !view?.download ? <p className="when">Loading…</p> : null}
        {view?.view && view.mime === "application/pdf" ? <iframe className="doc-frame" src={view.download || view.view} title={view.name} /> : null}
        {view?.view && view.mime.startsWith("image/") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="doc-img" src={view.view} alt={view.name} />
        ) : null}
        {view?.view && view.mime.startsWith("video/") ? <video className="doc-img" src={view.view} controls controlsList={view.download ? undefined : "nodownload"} /> : null}
        {view?.view && view.mime.startsWith("audio/") ? <audio src={view.view} controls controlsList={view.download ? undefined : "nodownload"} style={{ width: "100%" }} /> : null}
        {view?.view && view.mime === "text/plain" ? <iframe className="doc-frame" src={view.view} title={view.name} /> : null}
        {view && !view.view && view.download ? <p className="when">There is no preview for this type of file. Download it to open it.</p> : null}
        <div className="dlg-actions">
          {!view?.download && view?.view ? <span className="when" style={{ marginRight: "auto" }}>View only</span> : null}
          <button className="btn" type="button" onClick={() => viewer.current?.close()}>Close</button>
          {view?.download ? <a className="btn primary" href={view.download} style={{ textDecoration: "none" }}>Download</a> : null}
        </div>
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
