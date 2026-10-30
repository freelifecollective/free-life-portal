"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitFeedback } from "@/app/(app)/calls/actions";

/** "Give your feedback on the call": a small link that opens the three feedback questions. */
export function FeedbackLink({ callId, title }: { callId: string; title: string }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [a, setA] = useState({ thoughts: "", favourite: "", takeaway: "" });
  const [error, setError] = useState("");
  const [thanks, setThanks] = useState(false);

  const send = () => start(async () => {
    setError("");
    const r = await submitFeedback(callId, a.thoughts, a.favourite, a.takeaway);
    if (!r.ok) return setError(r.error ?? "That did not work.");
    setThanks(true);
  });
  const close = () => { dlg.current?.close(); if (thanks) router.refresh(); };

  return (
    <>
      <button type="button" className="linkbtn" style={{ padding: 0 }} onClick={() => dlg.current?.showModal()}>Give your feedback on the call</button>
      <dialog ref={dlg} className="rs-dialog" aria-labelledby={`fl-${callId}`} onClose={() => { if (thanks) router.refresh(); }}
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close(); }}>
        {thanks ? (
          <div>
            <h2 id={`fl-${callId}`} className="qh" style={{ marginTop: 0 }}>Thank you!</h2>
            <p>Your feedback helps us make every call better.</p>
            <div className="dlg-actions"><button className="btn primary" type="button" onClick={close}>Close</button></div>
          </div>
        ) : (
          <div>
            <h2 id={`fl-${callId}`} className="qh" style={{ marginTop: 0 }}>How was {title}?</h2>
            <div className="field"><label htmlFor={`fl1-${callId}`}>What did you think of the call?</label><textarea id={`fl1-${callId}`} rows={3} maxLength={1500} value={a.thoughts} onChange={(e) => setA({ ...a, thoughts: e.target.value })} /></div>
            <div className="field" style={{ marginTop: 12 }}><label htmlFor={`fl2-${callId}`}>What was your favourite part?</label><textarea id={`fl2-${callId}`} rows={3} maxLength={1500} value={a.favourite} onChange={(e) => setA({ ...a, favourite: e.target.value })} /></div>
            <div className="field" style={{ marginTop: 12 }}><label htmlFor={`fl3-${callId}`}>What was your biggest takeaway?</label><textarea id={`fl3-${callId}`} rows={3} maxLength={1500} value={a.takeaway} onChange={(e) => setA({ ...a, takeaway: e.target.value })} /></div>
            <p className="err" role="alert">{error}</p>
            <div className="dlg-actions"><button className="btn" type="button" onClick={close}>Not now</button><button className="btn primary" type="button" disabled={pending} onClick={send}>{pending ? "Sending…" : "Submit"}</button></div>
          </div>
        )}
      </dialog>
    </>
  );
}
