"use client";

import { useActionState } from "react";
import { logMyMilestone, removeMyMilestone } from "@/app/(app)/settings/milestones";

export type MyEvent = { id: string; kind: "coaching" | "sale"; happened_on: string; note: string | null; mine: boolean };

/** Log your own coaching calls and sales (they hand out the coaching and sales badges). */
export function MyMilestones({ today, events }: { today: string; events: MyEvent[] }) {
  const [state, run, pending] = useActionState(logMyMilestone, { error: "", done: "" });
  return (
    <div>
      <form action={run} className="admin-form" noValidate key={state.done}>
        <div className="row">
          <div className="field"><label htmlFor="mm-kind">What happened?</label>
            <select id="mm-kind" name="kind" defaultValue="coaching"><option value="coaching">I took a coaching call</option><option value="sale">I made a sale</option></select></div>
          <div className="field"><label htmlFor="mm-day">Date</label><input id="mm-day" name="day" type="date" defaultValue={today} max={today} required /></div>
        </div>
        <div className="row">
          <div className="field"><label htmlFor="mm-count">How many?</label><input id="mm-count" name="count" type="number" min={1} max={20} defaultValue={1} required /></div>
          <div className="field"><label htmlFor="mm-note">Note for yourself (optional)</label><input id="mm-note" name="note" type="text" maxLength={200} /></div>
        </div>
        <p className={"status" + (state.error ? " bad" : state.done ? " ok" : "")} role="status">{state.error || state.done}</p>
        <div className="actions" style={{ marginTop: 0 }}><button className="btn primary" type="submit" disabled={pending}>{pending ? "Saving…" : "Log it"}</button></div>
      </form>
      {events.length ? (
        <ul className="admin-list" style={{ marginTop: 14 }}>
          {events.map((e) => (
            <li key={e.id}>
              <div><strong>{e.kind === "sale" ? "Sale" : "Coaching call"}</strong><div className="muted-line">{e.happened_on}{e.note ? ` · ${e.note}` : ""}</div></div>
              {e.mine ? <form action={removeMyMilestone}><input type="hidden" name="id" value={e.id} /><button className="linkbtn" type="submit">Remove</button></form> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
