"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setFolderPlacement } from "@/app/(app)/documents/actions";
import { PLACEMENTS } from "@/lib/documents/placements";

/** "Show this folder's documents on…": pick the page they appear on, below its subtitle. */
export function FolderPlacement({ folderId, name, current }: { folderId: string; name: string; current: string }) {
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="card-s" style={{ margin: "0 0 14px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div className="field" style={{ minWidth: 260 }}>
        <label htmlFor="fp-sel">Show the documents in “{name}” on this page</label>
        <select id="fp-sel" value={value} onChange={(e) => { setValue(e.target.value); setMsg(""); }}>
          <option value="">Not shown on any page</option>
          {PLACEMENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <button type="button" className="btn small primary" disabled={pending || value === current && !msg} onClick={() => start(async () => { const r = await setFolderPlacement(folderId, value); setMsg(r.ok ? "Saved ✓" : r.error ?? ""); router.refresh(); })}>{pending ? "Saving…" : "Save"}</button>
      <span className="when" role="status">{msg}</span>
    </div>
  );
}
