"use client";

import { useRef, useState, useTransition } from "react";
import { removePerson, setRole } from "@/app/(app)/admin/people/actions";

const WHY = [["cancelled", "They cancelled their subscription and closed their account"], ["unpaid", "Removed for non-payment"], ["manual", "We are removing them"]] as const;

/** The status dropdown on a member or lead: change what they are, or remove or block them (each asks to be typed to confirm). */
export function PersonStatus({ id, name, role }: { id: string; name: string; role: string }) {
  const [value, setValue] = useState(role);
  const [mode, setMode] = useState<"remove" | "block" | null>(null);
  const [typed, setTyped] = useState("");
  const [why, setWhy] = useState<string>("manual");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, run] = useTransition();
  const dlg = useRef<HTMLDialogElement>(null);

  function pick(v: string) {
    setSaved(false);
    if (v === "remove" || v === "block") {
      setMode(v); setTyped(""); setNote(""); setWhy("manual"); setError("");
      dlg.current?.showModal();
      return; /* the dropdown keeps showing their real status until they confirm */
    }
    setValue(v);
  }
  function saveRole() {
    const fd = new FormData(); fd.set("id", id); fd.set("role", value);
    run(async () => { await setRole(fd); setSaved(true); });
  }
  function confirm() {
    if (!mode) return;
    run(async () => {
      const r = await removePerson(id, mode, why, note, typed);
      if ("error" in r) setError(r.error); else dlg.current?.close();
    });
  }
  const word = mode ?? "remove";
  return (
    <span className="inline-form">
      <label className="sr-only" htmlFor={`st-${id}`}>Status for {name}</label>
      <select id={`st-${id}`} value={value} onChange={(e) => pick(e.target.value)}>
        <option value="downline">downline</option><option value="lead">lead</option><option value="member">member</option><option value="admin">admin</option>
        <option value="remove">remove</option><option value="block">block</option>
      </select>
      {value !== role ? <button className="btn small" type="button" disabled={pending} onClick={saveRole}>Save</button> : null}
      {saved && value === role ? <span className="muted-line">Saved ✓</span> : null}
      <dialog ref={dlg} className="rs-dialog" aria-labelledby={`rm-${id}`} onClose={() => setMode(null)}>
        <h2 id={`rm-${id}`} className="qh" style={{ marginTop: 0 }}>{mode === "block" ? "Block" : "Remove"} <span translate="no">{name}</span>?</h2>
        {mode === "block" ? (
          <p>Are you sure you want to remove <strong translate="no">{name}</strong> from the portal and block them from ever having an account in the future? They will lose access to everything and will not be able to log in again ever again.</p>
        ) : (
          <p>Are you sure you want to remove <strong translate="no">{name}</strong> from the portal. They will lose access to everything and will not be able to log in again unless they are re-added.</p>
        )}
        {mode === "remove" ? (
          <div className="field">
            <label htmlFor={`why-${id}`}>Why are they being removed?</label>
            <select id={`why-${id}`} value={why} onChange={(e) => setWhy(e.target.value)}>{WHY.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </div>
        ) : null}
        {mode === "block" || why === "manual" ? (
          <div className="field">
            <label htmlFor={`note-${id}`}>{mode === "block" ? "Why are you blocking them? (kept for future reference)" : "Why are you removing them? (kept for future reference)"}</label>
            <textarea id={`note-${id}`} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        ) : null}
        <div className="field">
          <label htmlFor={`type-${id}`}>Type the word <strong>{word}</strong> to confirm</label>
          <input id={`type-${id}`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </div>
        {error ? <p className="err" role="alert">{error}</p> : null}
        <div className="dlg-actions">
          <button className="btn" type="button" onClick={() => dlg.current?.close()}>Cancel</button>
          <button className="btn primary" type="button" disabled={pending || typed.trim().toLowerCase() !== word} onClick={confirm}>{mode === "block" ? "block + remove" : "remove"}</button>
        </div>
      </dialog>
    </span>
  );
}
