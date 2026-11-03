"use client";

import { useState, useTransition } from "react";
import { canvaEmbedUrl } from "@/lib/resources/canva";
import { deleteResource, updateResource } from "@/app/(app)/admin/resource-library/actions";

export type EditItem = { id: string; title: string; url: string; image_url: string | null; description: string | null };

/** The saved items, each with Edit (name, link, picture, description) and Delete. */
export function ResourceEditList({ items, cards }: { items: EditItem[]; cards?: boolean }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [vals, setVals] = useState({ title: "", url: "", image_url: "", description: "" });
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  function open(i: EditItem) { setEditing(i.id); setErr(""); setVals({ title: i.title, url: i.url, image_url: i.image_url ?? "", description: i.description ?? "" }); }
  function save(id: string) {
    start(async () => { const r = await updateResource(id, vals); if (r.ok) setEditing(null); else setErr(r.error ?? ""); });
  }
  if (cards) {
    return (
      <ul className="res-grid">
        {items.map((i) => editing === i.id ? (
          <li key={i.id} className="res-card" style={{ gridColumn: "1 / -1", padding: 16 }}>
            <div className="admin-form" style={{ maxWidth: 620 }}>
              <div className="field"><label htmlFor={`re-t-${i.id}`}>Name</label><input id={`re-t-${i.id}`} value={vals.title} maxLength={160} onChange={(e) => setVals({ ...vals, title: e.target.value })} /></div>
              <div className="field"><label htmlFor={`re-u-${i.id}`}>Link</label><input id={`re-u-${i.id}`} value={vals.url} onChange={(e) => setVals({ ...vals, url: e.target.value })} /></div>
              <div className="field"><label htmlFor={`re-i-${i.id}`}>Picture link (optional)</label><input id={`re-i-${i.id}`} value={vals.image_url} onChange={(e) => setVals({ ...vals, image_url: e.target.value })} /></div>
              <div className="field"><label htmlFor={`re-d-${i.id}`}>Short description (optional)</label><textarea id={`re-d-${i.id}`} rows={2} maxLength={600} value={vals.description} onChange={(e) => setVals({ ...vals, description: e.target.value })} /></div>
              {err ? <p className="err" role="alert">{err}</p> : null}
              <div className="actions" style={{ marginTop: 0 }}>
                <button type="button" className="btn primary" disabled={pending} onClick={() => save(i.id)}>{pending ? "Saving…" : "Save"}</button>
                <button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </div>
          </li>
        ) : (
          <li key={i.id} className="res-card">
            <a href={i.url} target="_blank" rel="noopener noreferrer" className="res-link">
              {i.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="res-img" src={i.image_url} alt="" loading="lazy" />
              ) : canvaEmbedUrl(i.url) ? (
                <span className="res-img res-embed"><iframe src={canvaEmbedUrl(i.url)!} title={`Preview of ${i.title}`} loading="lazy" tabIndex={-1} sandbox="allow-scripts allow-same-origin" /></span>
              ) : <span className="res-img res-fallback" aria-hidden="true">✦</span>}
              <span className="res-title" translate="no">{i.title}</span>
              {i.description ? <span className="res-desc" translate="no">{i.description}</span> : null}
            </a>
            <div className="res-admin">
              <button type="button" className="linkbtn" onClick={() => open(i)}>Edit</button>
              <form action={deleteResource}><input type="hidden" name="id" value={i.id} /><button className="linkbtn" type="submit">Delete</button></form>
            </div>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="admin-list">
      {items.map((i) => (
        <li key={i.id} style={editing === i.id ? { display: "block" } : undefined}>
          {editing === i.id ? (
            <div className="admin-form" style={{ maxWidth: 620 }}>
              <div className="field"><label htmlFor={`re-t-${i.id}`}>Name</label><input id={`re-t-${i.id}`} value={vals.title} maxLength={160} onChange={(e) => setVals({ ...vals, title: e.target.value })} /></div>
              <div className="field"><label htmlFor={`re-u-${i.id}`}>Link</label><input id={`re-u-${i.id}`} value={vals.url} onChange={(e) => setVals({ ...vals, url: e.target.value })} /></div>
              <div className="field"><label htmlFor={`re-i-${i.id}`}>Picture link (optional)</label><input id={`re-i-${i.id}`} value={vals.image_url} onChange={(e) => setVals({ ...vals, image_url: e.target.value })} /></div>
              <div className="field"><label htmlFor={`re-d-${i.id}`}>Short description (optional)</label><textarea id={`re-d-${i.id}`} rows={2} maxLength={600} value={vals.description} onChange={(e) => setVals({ ...vals, description: e.target.value })} /></div>
              {err ? <p className="err" role="alert">{err}</p> : null}
              <div className="actions" style={{ marginTop: 0 }}>
                <button type="button" className="btn primary" disabled={pending} onClick={() => save(i.id)}>{pending ? "Saving…" : "Save"}</button>
                <button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div><strong translate="no">{i.title}</strong><div className="muted-line" translate="no" style={{ wordBreak: "break-all" }}>{i.url.length > 90 ? i.url.slice(0, 90) + "…" : i.url}</div></div>
              <span style={{ display: "inline-flex", gap: 12, alignItems: "center" }}>
                <button type="button" className="linkbtn" onClick={() => open(i)}>Edit</button>
                <form action={deleteResource}><input type="hidden" name="id" value={i.id} /><button className="linkbtn" type="submit">Delete</button></form>
              </span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
