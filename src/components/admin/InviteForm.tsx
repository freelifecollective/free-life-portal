"use client";

import { useActionState } from "react";
import { inviteEmail } from "@/app/(app)/admin/people/actions";

export function InviteForm() {
  const [state, run, pending] = useActionState(inviteEmail, { error: "", done: "" });
  return (
    <form action={run} className="admin-form" noValidate key={state.done}>
      <div className="row">
        <div className="field"><label htmlFor="inv-email">Email</label><input id="inv-email" name="email" type="email" autoComplete="off" required /></div>
        <div className="field"><label htmlFor="inv-role">They start as</label>
          <select id="inv-role" name="role" defaultValue="lead"><option value="lead">Lead</option><option value="member">Member (affiliate)</option></select></div>
      </div>
      <div className="field"><label htmlFor="inv-note">Note for yourself (optional)</label><input id="inv-note" name="note" type="text" maxLength={200} /></div>
      <p className={"status" + (state.error ? " bad" : state.done ? " ok" : "")} role="status">{state.error || state.done}</p>
      <div className="actions" style={{ marginTop: 0 }}><button className="btn primary" type="submit" disabled={pending}>{pending ? "Adding…" : "Invite"}</button></div>
    </form>
  );
}
