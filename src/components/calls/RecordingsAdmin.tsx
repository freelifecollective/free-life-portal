"use client";

import { useActionState, useState, useTransition } from "react";
import { deleteRecording, saveRecording, setPublished, type RecordingState } from "@/app/(app)/admin/recordings/actions";
import { formatTime } from "@/lib/recordings/vimeo";
import type { Recording } from "@/lib/recordings/queries";
import { formatInZone, toZonedInput } from "@/lib/time";

type CallOpt = { id: string; title: string; starts_at: string };

function RecordingForm({ rec, calls, onDone }: { rec: Recording | null; calls: CallOpt[]; onDone: () => void }) {
  const [state, action, pending] = useActionState(saveRecording.bind(null, rec?.id ?? null), { error: "" } as RecordingState);
  if (state.saved) queueMicrotask(onDone);
  return (
    <form action={action} className="set-form card-s">
      <h2 className="qh" style={{ margin: 0 }}>{rec ? "Edit recording" : "Add a recording"}</h2>
      <div className="field"><label htmlFor="r-url">Vimeo link</label><input id="r-url" name="url" type="text" required defaultValue={rec ? `https://vimeo.com/${rec.vimeo_id}${rec.vimeo_hash ? "/" + rec.vimeo_hash : ""}` : ""} placeholder="https://vimeo.com/123456789" /></div>
      <div className="field"><label htmlFor="r-title">Title (leave empty to use the Vimeo title)</label><input id="r-title" name="title" type="text" maxLength={160} defaultValue={rec?.title} /></div>
      <div className="field"><label htmlFor="r-call">Which call is this?</label>
        <select id="r-call" name="call_id" defaultValue={rec?.call_id ?? ""}><option value="">Not linked to a call</option>{calls.map((c) => <option key={c.id} value={c.id}>{c.title} ({formatInZone(new Date(c.starts_at)).split(",").slice(0, 2).join(",")})</option>)}</select></div>
      <div className="row">
        <div className="field"><label htmlFor="r-start">Start at (optional)</label><input id="r-start" name="start" type="text" placeholder="5:30" defaultValue={formatTime(rec?.start_secs || null)} /></div>
        <div className="field"><label htmlFor="r-end">Stop at (optional)</label><input id="r-end" name="end" type="text" placeholder="1:02:15" defaultValue={formatTime(rec?.end_secs)} /></div>
      </div>
      <div className="field"><label htmlFor="r-when">Recorded on</label><input id="r-when" name="recorded_at" type="datetime-local" defaultValue={rec ? toZonedInput(new Date(rec.recorded_at)) : ""} /></div>
      <div className="field"><label htmlFor="r-desc">Description (optional)</label><textarea id="r-desc" name="description" rows={3} maxLength={2000} defaultValue={rec?.description ?? ""} /></div>
      <fieldset className="offer-pick" style={{ gridTemplateColumns: "1fr" }}>
        <legend>Who can watch (paying affiliates always can)</legend>
        <label className="check"><input type="checkbox" name="for_leads" defaultChecked={rec?.for_leads} /> Leads</label>
        <label className="check"><input type="checkbox" name="for_downline" defaultChecked={rec?.for_downline} /> Lacey&apos;s downline</label>
      </fieldset>
      <label className="check"><input type="checkbox" name="published" defaultChecked={rec?.published} /> Published (people can see it, and attendees are notified)</label>
      <p className="when" style={{ margin: 0 }}>In Vimeo, set the video to allow embedding on your portal&apos;s address, otherwise it will not play here.</p>
      <div className="set-actions">
        <button className="btn primary" type="submit" disabled={pending}>{pending ? "Saving…" : "Save recording"}</button>
        <button className="linkbtn" type="button" onClick={onDone}>Cancel</button>
      </div>
      <p className="err" role="alert">{state.error}</p>
    </form>
  );
}

export function RecordingsAdmin({ recordings, calls }: { recordings: Recording[]; calls: CallOpt[] }) {
  const [editing, setEditing] = useState<Recording | "new" | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="settings" style={{ maxWidth: 820 }}>
      {editing ? <RecordingForm key={editing === "new" ? "new" : editing.id} rec={editing === "new" ? null : editing} calls={calls} onDone={() => setEditing(null)} /> : <p style={{ margin: 0 }}><button className="btn primary" type="button" onClick={() => setEditing("new")}>Add a recording</button></p>}
      {recordings.length === 0 ? <section className="card-s"><p style={{ margin: 0 }}>No recordings yet.</p></section> : recordings.map((r) => (
        <article key={r.id} className="card-s rec-row">
          <div>
            <strong>{r.title}</strong> {!r.published ? <span className="doc-tag">Draft</span> : null} {r.for_leads ? <span className="doc-tag">Leads</span> : null} {r.for_downline ? <span className="doc-tag">Downline</span> : null}
            <div className="when">{formatInZone(new Date(r.recorded_at))}{r.start_secs || r.end_secs ? ` · plays ${formatTime(r.start_secs)}–${r.end_secs ? formatTime(r.end_secs) : "end"}` : ""}</div>
          </div>
          <div className="rs-actions" style={{ marginTop: 0 }}>
            <a className="btn small" href={`/calls/${r.id}`} style={{ textDecoration: "none" }}>Open</a>
            <button className="btn small" type="button" onClick={() => setEditing(r)}>Edit</button>
            <button className="btn small" type="button" disabled={pending} onClick={() => start(async () => { await setPublished(r.id, !r.published); })}>{r.published ? "Unpublish" : "Publish"}</button>
            <button className="linkbtn danger" type="button" disabled={pending} onClick={() => { if (window.confirm("Delete this recording?")) start(async () => { await deleteRecording(r.id); }); }}>Delete</button>
          </div>
        </article>
      ))}
    </div>
  );
}
