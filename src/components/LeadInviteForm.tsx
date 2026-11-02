"use client";

import { useActionState } from "react";
import { inviteLead } from "@/app/(app)/leads/actions";

/** Invite a lead by email. They get a sign-in link and become your lead. */
export function LeadInviteForm() {
  const [state, run, pending] = useActionState(inviteLead, { error: "", done: "" });
  return (
    <form action={run} className="admin-form" noValidate key={state.done}>
      <div className="row">
        <div className="field"><label htmlFor="li-email">Their email</label><input id="li-email" name="email" type="email" autoComplete="off" required /></div>
        <div className="field"><label htmlFor="li-note">Note for yourself (optional)</label><input id="li-note" name="note" type="text" maxLength={200} /></div>
      </div>
      <p className={"status" + (state.error ? " bad" : state.done ? " ok" : "")} role="status">{state.error || state.done}</p>
      <div className="actions" style={{ marginTop: 0 }}><button className="btn primary" type="submit" disabled={pending}>{pending ? "Inviting…" : "Invite lead"}</button></div>
    </form>
  );
}
