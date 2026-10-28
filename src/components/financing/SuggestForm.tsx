"use client";

import { useActionState, useEffect, useRef } from "react";
import { addFinancing, suggestFinancing, type FinancingState } from "@/app/(app)/financing/actions";

export function SuggestForm({ isAdmin }: { isAdmin: boolean }) {
  const [state, action, pending] = useActionState(isAdmin ? addFinancing : suggestFinancing, { error: "" } as FinancingState);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.sent) form.current?.reset(); }, [state]);
  return (
    <form ref={form} action={action} className="set-form card-s">
      <h2 className="qh" style={{ margin: 0 }}>{isAdmin ? "Add a financing option" : "Suggest a financing option"}</h2>
      <p className="when" style={{ margin: 0 }}>{isAdmin ? "It is added to the list straight away." : "Check the list first. If it is not there, tell us about it and we will review it."}</p>
      <div className="field"><label htmlFor="f-t">Name</label><input id="f-t" name="title" type="text" required maxLength={100} /></div>
      <div className="field"><label htmlFor="f-d">What is it and how does it help?</label><textarea id="f-d" name="description" required rows={4} maxLength={1500} /></div>
      <div className="field"><label htmlFor="f-l">Link (optional)</label><input id="f-l" name="link" type="text" inputMode="url" placeholder="https://" /></div>
      <div className="set-actions">
        <button className="btn primary" type="submit" disabled={pending}>{pending ? "Sending…" : isAdmin ? "Add to the list" : "Submit for review"}</button>
        <span role="status" className="when">{state.sent ? (state.approved ? "Added." : "Submitted successfully. Thank you for your submission and helping to improve our community!") : ""}</span>
      </div>
      <p className="err" role="alert">{state.error}</p>
    </form>
  );
}
