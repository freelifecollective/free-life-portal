"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addBookedCall } from "@/app/(app)/booked-calls/actions";

/** "Hire Sonya": book a call with this closer. It lands in Coaching Calls Booked on Home, and the closer is told. */
export function HireButton({ closerId, first }: { closerId: string; first: string }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [lead, setLead] = useState("");
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const close = () => { dlg.current?.close(); setDone(false); setError(""); };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError("");
      const r = await addBookedCall({ lead, when, closer: closerId, note });
      if (!r.ok) { setError(r.error); return; }
      setDone(true); setLead(""); setWhen(""); setNote("");
      router.refresh();
    });
  };
  return (
    <>
      <button type="button" className="btn primary cc-hire" onClick={() => dlg.current?.showModal()}>{`Hire ${first}`}</button>
      <dialog ref={dlg} className="rs-dialog" aria-label={`Hire ${first}`} onClick={(e) => { if (e.target === dlg.current) close(); }}>
        {done ? (
          <div style={{ display: "grid", gap: 12 }}>
            <h2 className="qh" style={{ margin: 0 }}>{`Booked! ${first} has been told.`}</h2>
            <p style={{ margin: 0 }}>You can see the call in Coaching Calls Booked on Home. Message them to share any details.</p>
            <div className="dlg-actions"><button className="btn" type="button" onClick={close}>Close</button></div>
          </div>
        ) : (
          <form onSubmit={submit} className="set-form">
            <h2 className="qh" style={{ margin: 0 }}>{`Hire ${first} for a call`}</h2>
            <div className="field"><label htmlFor={`hl-${closerId}`}>Your lead&rsquo;s name</label><input id={`hl-${closerId}`} type="text" required maxLength={80} value={lead} onChange={(e) => setLead(e.target.value)} /></div>
            <div className="field"><label htmlFor={`hw-${closerId}`}>Date and time of the call (your time zone)</label><input id={`hw-${closerId}`} type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)} /></div>
            <div className="field"><label htmlFor={`hn-${closerId}`}>A note for the closer (optional)</label><input id={`hn-${closerId}`} type="text" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} /></div>
            <p className="err" role="alert" style={{ minHeight: 0 }}>{error}</p>
            <div className="dlg-actions"><button className="btn" type="button" onClick={close}>Cancel</button><button className="btn primary" type="submit" disabled={pending}>{pending ? "Booking…" : "Book the call"}</button></div>
          </form>
        )}
      </dialog>
    </>
  );
}
