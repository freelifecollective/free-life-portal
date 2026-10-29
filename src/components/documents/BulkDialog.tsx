"use client";

import { useRef, useState } from "react";
import { copyFile, deleteItem, makeCopyFolder, moveItem, treeOf } from "@/app/(app)/documents/actions";
import type { DocFolder } from "@/lib/documents/types";

export type Picked = { kind: "folder" | "file"; id: string; name: string };

/** Move, copy or delete the selected documents and folders, one step at a time, with progress. */
export function BulkDialog({ mode, items, folders, currentFolder, onClose, onDone }: {
  mode: "move" | "copy" | "delete"; items: Picked[]; folders: DocFolder[]; currentFolder: string | null; onClose: () => void; onDone: () => void;
}) {
  const [to, setTo] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const stop = useRef(false);

  // a folder cannot go into itself or anything inside it
  const blocked = new Set<string>();
  for (const i of items) if (i.kind === "folder") blocked.add(i.id);
  for (let grew = true; grew; ) { grew = false; for (const f of folders) if (f.parent_id && blocked.has(f.parent_id) && !blocked.has(f.id)) { blocked.add(f.id); grew = true; } }
  const path = (id: string): string => { const f = folders.find((x) => x.id === id); return f ? (f.parent_id ? path(f.parent_id) + " / " : "") + f.name : ""; };
  const options = folders.filter((f) => mode === "copy" || !blocked.has(f.id)).map((f) => ({ id: f.id, label: path(f.id) })).sort((a, b) => a.label.localeCompare(b.label));

  const say = (l: string) => setLines((p) => [...p.slice(-5), l]);

  async function run() {
    setBusy(true); setProblems([]); setLines([]); stop.current = false;
    const bad: string[] = [];
    const dest = to || null;
    try {
      if (mode === "move") {
        let n = 0;
        for (const i of items) { const r = await moveItem(i.kind, i.id, dest); if (r.ok) { n++; say(`Moved ${i.name}`); } else bad.push(`${i.name}: ${r.error}`); }
        say(`${n} moved.`);
      } else if (mode === "delete") {
        let n = 0;
        for (const i of items) { const r = await deleteItem(i.kind, i.id); if (r.ok) { n++; say(`Deleted ${i.name}`); } else bad.push(`${i.name}: ${r.error}`); }
        say(`${n} deleted.`);
      } else {
        const tree = await treeOf(items.map((i) => ({ kind: i.kind, id: i.id })));
        if (!tree.ok) throw new Error(tree.error ?? "Could not read the selection.");
        const sameSpot = dest === currentFolder;
        const map = new Map<string, string | null>();
        const chosenFolders = new Set(items.filter((i) => i.kind === "folder").map((i) => i.id));
        // folders first, parents before children
        const byParent = new Map<string | null, typeof tree.folders>();
        for (const f of tree.folders) byParent.set(f.parent_id, [...(byParent.get(f.parent_id) ?? []), f]);
        const queue = tree.folders.filter((f) => chosenFolders.has(f.id));
        const seen = new Set<string>();
        while (queue.length) {
          const f = queue.shift()!;
          if (seen.has(f.id)) continue;
          seen.add(f.id);
          const parent = chosenFolders.has(f.id) ? dest : map.get(f.parent_id ?? "") ?? dest;
          const r = await makeCopyFolder(parent, f.name, f.for_leads, f.for_downline, chosenFolders.has(f.id) && sameSpot);
          if (!r.ok || !r.id) { bad.push(`${f.name}: ${r.error}`); continue; }
          map.set(f.id, r.id); say(`Copied folder ${f.name}`);
          queue.push(...(byParent.get(f.id) ?? []));
        }
        let n = 0;
        for (const file of tree.files) {
          const inChosenFolder = file.folder_id !== null && map.has(file.folder_id);
          if (file.folder_id !== null && !inChosenFolder && !items.some((i) => i.kind === "file" && i.id === file.id)) continue;
          const target = inChosenFolder ? map.get(file.folder_id!) ?? dest : dest;
          const r = await copyFile(file.id, target ?? null, !inChosenFolder && sameSpot);
          if (r.ok) { n++; if (n % 5 === 0 || tree.files.length < 10) say(`Copied ${n} of ${tree.files.length} documents`); } else bad.push(r.error ?? file.name);
        }
        say(`${n} document${n === 1 ? "" : "s"} copied.`);
      }
    } catch (e) { bad.push(e instanceof Error ? e.message : "Something went wrong."); }
    setProblems(bad); setBusy(false);
    if (!bad.length) onDone();
  }

  const title = mode === "move" ? "Move to…" : mode === "copy" ? "Copy to…" : "Delete these?";
  return (
    <div>
      <h2 className="qh" style={{ marginTop: 0 }}>{title}</h2>
      <p className="when" style={{ margin: "0 0 12px" }}>{items.length} selected: {items.slice(0, 4).map((i) => i.name).join(", ")}{items.length > 4 ? ` and ${items.length - 4} more` : ""}</p>
      {mode === "delete" ? (
        <p>This also deletes everything inside any folders you selected, and it can&apos;t be undone from here.</p>
      ) : (
        <div className="field">
          <label htmlFor="bulk-to">{mode === "move" ? "Move" : "Copy"} into</label>
          <select id="bulk-to" value={to} onChange={(e) => setTo(e.target.value)} disabled={busy}>
            <option value="">Top level</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
      )}
      {lines.length ? <ul className="doc-progress" style={{ marginTop: 12 }} aria-live="polite">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul> : null}
      {problems.length ? <ul className="err" role="alert" style={{ marginTop: 10, paddingLeft: 18 }}>{problems.slice(0, 6).map((p, i) => <li key={i}>{p}</li>)}</ul> : null}
      <div className="dlg-actions">
        <button className="btn" type="button" disabled={busy} onClick={onClose}>{problems.length ? "Close" : "Cancel"}</button>
        <button className={"btn " + (mode === "delete" ? "" : "primary")} type="button" disabled={busy} onClick={run} style={mode === "delete" ? { borderColor: "#9b2c2c", color: "#9b2c2c" } : undefined}>{busy ? "Working…" : mode === "move" ? "Move here" : mode === "copy" ? "Copy here" : "Delete"}</button>
      </div>
    </div>
  );
}
