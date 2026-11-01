"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { endHire, hireCloser } from "@/app/(app)/call-closers/actions";

export type ActiveHire = { id: string; closer_id: string; calls_total: number | null; calls_used: number };

const CHOICES = [
  { id: 1, label: "One call", hint: "They take your next coaching call." },
  { id: 2, label: "Two calls", hint: "They take your next two coaching calls." },
  { id: 0, label: "All my future calls", hint: "Leads book with them instead of with you, until you stop." },
] as const;

/** "Hire Sonya": for one call, two calls, or every future call. Shows where the hire stands once it is made. */
export function HireButton({ closerId, first, hire, otherHire }: { closerId: string; first: string; hire: ActiveHire | null; otherHire: boolean }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [calls, setCalls] = useState<number>(1);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const close = () => { dlg.current?.close(); setError(""); };

  if (hire) {
    const left = hire.calls_total === null ? null : hire.calls_total - hire.calls_used;
    return (
      <div className="cc-hired">
        <p style={{ margin: 0 }}><strong>{`${first} is hired`}</strong></p>
        <p className="when" style={{ margin: 0 }}>{left === null ? "They take all your future coaching calls." : left === 1 ? "They take your next coaching call." : `They take your next ${left} coaching calls.`}</p>
        <button type="button" className="btn small" disabled={pending} onClick={() => start(async () => { await endHire(hire.id); router.refresh(); })}>Stop this hire</button>
      </div>
    );
  }
  if (otherHire) return <p className="when" style={{ margin: 0 }}>{`You have another call closer hired. Stop that hire first to hire ${first}.`}</p>;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError("");
      const r = await hireCloser(closerId, calls, note);
      if (!r.ok) { setError(r.error ?? "That did not work."); return; }
      close(); setNote("");
      router.refresh();
    });
  };
  return (
    <>
      <button type="button" className="btn primary cc-hire" onClick={() => dlg.current?.showModal()}>{`Hire ${first}`}</button>
      <dialog ref={dlg} className="rs-dialog" aria-label={`Hire ${first}`} onClick={(e) => { if (e.target === dlg.current) close(); }}>
        <form onSubmit={submit} className="set-form">
          <h2 className="qh" style={{ margin: 0 }}>{`Hire ${first}`}</h2>
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
            <legend className="when" style={{ padding: 0, marginBottom: 6 }}>How long do you want to hire them?</legend>
            {CHOICES.map((c) => (
              <label key={c.id} className="hire-opt" style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 12, cursor: "pointer", background: calls === c.id ? "var(--tint)" : "#fff" }}>
                <input type="radio" name="calls" checked={calls === c.id} onChange={() => setCalls(c.id)} style={{ marginTop: 4 }} />
                <span><strong>{c.label}</strong><br /><span className="when">{c.hint}</span></span>
              </label>
            ))}
          </fieldset>
          <div className="field"><label htmlFor={`hn-${closerId}`}>A note for the closer (optional)</label><input id={`hn-${closerId}`} type="text" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <p className="err" role="alert" style={{ minHeight: 0 }}>{error}</p>
          <div className="dlg-actions"><button className="btn" type="button" onClick={close}>Cancel</button><button className="btn primary" type="submit" disabled={pending}>{pending ? "Hiring…" : `Hire ${first}`}</button></div>
        </form>
      </dialog>
    </>
  );
}
