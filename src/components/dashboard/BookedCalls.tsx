"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addBookedCall, removeBookedCall } from "@/app/(app)/booked-calls/actions";
import { Avatar } from "@/components/Avatar";
import { TrashButton } from "@/components/tasks/TrashButton";

export type BookedCall = { id: string; lead_name: string; when: string; closer: { name: string; photo_url: string | null } | null };
export type Closer = { id: string; name: string };

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("") || "?";

/** "Calls Booked": the calls coming up with leads, who is taking each one, and a way to add a call. */
export function BookedCalls({ calls, closers, tz }: { calls: BookedCall[]; closers: Closer[]; tz: string }) {
  const router = useRouter();
  const dlg = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [lead, setLead] = useState("");
  const [when, setWhen] = useState("");
  const [closer, setCloser] = useState("");
  const [error, setError] = useState("");
  const [pending, run] = useTransition();

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    run(async () => {
      const r = await addBookedCall({ lead, when, closer });
      if (!r.ok) return setError(r.error);
      setOpen(false); setLead(""); setWhen(""); setCloser("");
      router.refresh();
    });
  };

  return (
    <section className="home-card booked" aria-label="Calls booked">
      <div className="booked-head">
        <div><span className="hs-label">Calls Booked</span><span className="hs-big">{calls.length}</span></div>
        <button type="button" className="btn" onClick={() => { setError(""); setOpen(true); }}>Add a call</button>
      </div>
      {calls.length === 0 ? (
        <p className="when" style={{ margin: 0 }}>No calls booked yet. When a lead books a call with you, add it here and it shows up with who is taking it.</p>
      ) : (
        <ul className="booked-list">
          {calls.map((c) => (
            <li key={c.id}>
              <div className="booked-main">
                <strong>{c.lead_name}</strong>
                <span className="when">{c.when}</span>
              </div>
              {c.closer ? (
                <div className="booked-closer" title={`${c.closer.name} is taking this call`}>
                  <Avatar url={c.closer.photo_url} initials={initials(c.closer.name)} size={38} label={c.closer.name} />
                  <span><small>Call closer</small><strong>{c.closer.name}</strong></span>
                </div>
              ) : <span className="when">You are taking this call</span>}
              <TrashButton label={c.lead_name} busy={pending} onConfirm={() => run(async () => { await removeBookedCall(c.id); router.refresh(); })} />
            </li>
          ))}
        </ul>
      )}

      <dialog ref={dlg} className="rs-dialog" aria-labelledby="bc-title" onClose={() => setOpen(false)}
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) setOpen(false); }}>
        <form onSubmit={save} noValidate>
          <h2 id="bc-title" className="qh" style={{ marginTop: 0 }}>Add a call</h2>
          <div className="field"><label htmlFor="bc-lead">Lead&apos;s name</label><input id="bc-lead" type="text" maxLength={80} required autoFocus value={lead} onChange={(e) => setLead(e.target.value)} /></div>
          <div className="field" style={{ marginTop: 12 }}><label htmlFor="bc-when">Date and time</label><input id="bc-when" type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)} />
            <span className="when">In your time zone ({tz.replace(/_/g, " ")}).</span></div>
          {closers.length ? (
            <div className="field" style={{ marginTop: 12 }}><label htmlFor="bc-closer">Who is taking the call?</label>
              <select id="bc-closer" value={closer} onChange={(e) => setCloser(e.target.value)}>
                <option value="">I am taking it myself</option>
                {closers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
          ) : null}
          <p className="err" role="alert">{error}</p>
          <div className="dlg-actions"><button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button><button type="submit" className="btn primary" disabled={pending || !lead.trim() || !when}>{pending ? "Saving…" : "Add call"}</button></div>
        </form>
      </dialog>
    </section>
  );
}
