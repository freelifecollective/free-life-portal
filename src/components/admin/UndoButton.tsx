"use client";

import { useState, useTransition } from "react";
import { undoActivity } from "@/app/(app)/admin/activity/actions";

export function UndoButton({ id }: { id: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className="act-undo">
      <button className="btn small" type="button" disabled={pending} onClick={() => start(async () => { setError(""); const r = await undoActivity(id); if (!r.ok) setError(r.error ?? "That did not work."); })}>{pending ? "Undoing…" : "Undo"}</button>
      {error ? <p className="err" role="alert" style={{ margin: "4px 0 0", minHeight: 0 }}>{error}</p> : null}
    </div>
  );
}
