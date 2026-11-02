"use client";

import { useActionState } from "react";
import { addResource, type AddState } from "@/app/(app)/admin/resource-library/actions";
import { RESOURCE_TABS } from "@/lib/resources/kinds";

const initial: AddState = { error: "", done: "" };

export function ResourceForm() {
  const [state, action, pending] = useActionState(addResource, initial);
  return (
    <form action={action} className="admin-form" style={{ maxWidth: 560 }}>
      <div className="field"><label htmlFor="rl-cat">Where does it go?</label>
        <select id="rl-cat" name="category" defaultValue="books">{RESOURCE_TABS.map((t) => <option key={t.category} value={t.category}>{t.label}</option>)}</select></div>
      <div className="field"><label htmlFor="rl-title">Title</label><input id="rl-title" name="title" maxLength={160} required /></div>
      <div className="field"><label htmlFor="rl-url">Link (opens when someone taps it)</label><input id="rl-url" name="url" type="url" placeholder="https://" required /></div>
      <div className="field"><label htmlFor="rl-img">Picture link (optional)</label><input id="rl-img" name="image_url" type="url" placeholder="https://" /></div>
      <div className="field"><label htmlFor="rl-desc">Short description (optional)</label><textarea id="rl-desc" name="description" rows={2} maxLength={600} /></div>
      {state.error ? <p className="err" role="alert">{state.error}</p> : null}
      {state.done ? <p className="ok" role="status">{state.done}</p> : null}
      <div className="actions" style={{ marginTop: 0 }}><button className="btn primary" type="submit" disabled={pending}>{pending ? "Adding…" : "Add"}</button></div>
    </form>
  );
}
