"use client";

import { useActionState } from "react";
import { logMilestone } from "@/app/(app)/admin/people/actions";

/** For admins: record that a member took a coaching call or made a sale. */
export function MilestoneForm({ members, today }: { members: { id: string; name: string }[]; today: string }) {
  const [state, run, pending] = useActionState(logMilestone, { error: "", done: "" });
  return (
    <form action={run} className="admin-form" noValidate key={state.done}>
      <div className="row">
        <div className="field"><label htmlFor="ms-member">Member</label>
          <select id="ms-member" name="member" required defaultValue=""><option value="" disabled>Choose a member</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
        <div className="field"><label htmlFor="ms-kind">What happened?</label>
          <select id="ms-kind" name="kind" defaultValue="coaching"><option value="coaching">Took a coaching call</option><option value="sale">Made a sale</option></select></div>
      </div>
      <div className="row">
        <div className="field"><label htmlFor="ms-day">Date</label><input id="ms-day" name="day" type="date" defaultValue={today} max={today} required /></div>
        <div className="field"><label htmlFor="ms-count">How many?</label><input id="ms-count" name="count" type="number" min={1} max={20} defaultValue={1} required /></div>
      </div>
      <div className="field"><label htmlFor="ms-note">Note for yourself (optional)</label><input id="ms-note" name="note" type="text" maxLength={200} /></div>
      <p className={"status" + (state.error ? " bad" : state.done ? " ok" : "")} role="status">{state.error || state.done}</p>
      <div className="actions" style={{ marginTop: 0 }}><button className="btn primary" type="submit" disabled={pending}>{pending ? "Saving…" : "Log it"}</button></div>
    </form>
  );
}
