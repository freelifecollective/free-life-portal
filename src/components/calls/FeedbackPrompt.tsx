"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitFeedback } from "@/app/(app)/calls/actions";

export type PendingCall = { call_id: string; title: string };

/** After a call you joined live: what did you think, what was your favourite part, and your biggest takeaway. */
export function FeedbackPrompt({ calls }: { calls: PendingCall[] }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [i, setI] = useState(0);
  const [a, setA] = useState({ thoughts: "", favourite: "", takeaway: "" });
  const [error, setError] = useState("");
  const [thanks, setThanks] = useState(false);
  const call = calls[i];
  const first = calls[0]?.call_id;

  useEffect(() => {
    let skipped = false;
    try { skipped = sessionStorage.getItem("flc_fb_skip") === first; } catch { /* ignore */ }
    if (first && !skipped) queueMicrotask(() => dlg.current?.showModal());
  }, [first]);

  if (!call) return null;
  const later = () => { try { sessionStorage.setItem("flc_fb_skip", first ?? ""); } catch { /* ignore */ } dlg.current?.close(); };
  const send = () => start(async () => {
    setError("");
    const r = await submitFeedback(call.call_id, a.thoughts, a.favourite, a.takeaway);
    if (!r.ok) return setError(r.error ?? "That did not work.");
    setThanks(true);
  });
  const done = () => { setThanks(false); setA({ thoughts: "", favourite: "", takeaway: "" }); if (i + 1 < calls.length) setI(i + 1); else { dlg.current?.close(); router.refresh(); } };

  return (
    <dialog ref={dlg} className="rs-dialog" aria-labelledby="fp-title" onCancel={later}>
      {thanks ? (
        <div>
          <h2 id="fp-title" className="qh" style={{ marginTop: 0 }}>Thank you!</h2>
          <p>Your feedback helps us make every call better. Once the recording is up, you will be able to see what everyone else said about it.</p>
          <div className="dlg-actions"><button className="btn primary" type="button" onClick={done}>Close</button></div>
        </div>
      ) : (
        <div>
          <h2 id="fp-title" className="qh" style={{ marginTop: 0 }}>How was {call.title}?</h2>
          <div className="field"><label htmlFor="fp-1">What did you think of the call?</label><textarea id="fp-1" rows={3} maxLength={1500} value={a.thoughts} onChange={(e) => setA({ ...a, thoughts: e.target.value })} /></div>
          <div className="field" style={{ marginTop: 12 }}><label htmlFor="fp-2">What was your favourite part?</label><textarea id="fp-2" rows={3} maxLength={1500} value={a.favourite} onChange={(e) => setA({ ...a, favourite: e.target.value })} /></div>
          <div className="field" style={{ marginTop: 12 }}><label htmlFor="fp-3">What was your biggest takeaway?</label><textarea id="fp-3" rows={3} maxLength={1500} value={a.takeaway} onChange={(e) => setA({ ...a, takeaway: e.target.value })} /></div>
          <p className="err" role="alert">{error}</p>
          <div className="dlg-actions"><button className="btn" type="button" onClick={later}>Maybe later</button><button className="btn primary" type="button" disabled={pending} onClick={send}>{pending ? "Sending…" : "Submit"}</button></div>
        </div>
      )}
    </dialog>
  );
}
