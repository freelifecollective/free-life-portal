"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewApplication } from "@/app/(app)/admin/closer-applications/actions";

/** Approve or decline one application, with an optional note the applicant sees. */
export function ReviewControls({ id }: { id: string }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (approve: boolean) => start(async () => {
    setError("");
    const r = await reviewApplication(id, approve, note);
    if (!r.ok) setError(r.error ?? "That did not work."); else router.refresh();
  });
  return (
    <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
      <input type="text" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Note for the applicant (optional)" aria-label="Note for the applicant" style={{ font: "inherit", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px" }} />
      <div className="rs-actions" style={{ marginTop: 0 }}>
        <button type="button" className="btn small primary" disabled={pending} onClick={() => run(true)}>Approve</button>
        <button type="button" className="btn small" disabled={pending} onClick={() => run(false)}>Decline</button>
      </div>
      {error ? <p className="err" role="alert" style={{ minHeight: 0, margin: 0 }}>{error}</p> : null}
    </div>
  );
}
