"use client";

import { useActionState } from "react";
import { addCanvaLinks, type AddState } from "@/app/(app)/admin/resource-library/actions";

const initial: AddState = { error: "", done: "" };

/** Paste a pile of Canva links; each one becomes a template card with a preview. */
export function CanvaLinksForm() {
  const [state, action, pending] = useActionState(addCanvaLinks, initial);
  return (
    <form action={action} className="admin-form" style={{ maxWidth: 620 }}>
      <div className="field"><label htmlFor="cl-links">Canva links, one per line (a name before the link is optional)</label>
        <textarea id="cl-links" name="links" rows={8} placeholder={"Instagram story template  https://www.canva.com/design/…/view\nhttps://www.canva.com/design/…/view"} required /></div>
      {state.error ? <p className="err" role="alert">{state.error}</p> : null}
      {state.done ? <p className="ok" role="status">{state.done}</p> : null}
      <div className="actions" style={{ marginTop: 0 }}><button className="btn primary" type="submit" disabled={pending}>{pending ? "Adding…" : "Add these templates"}</button></div>
    </form>
  );
}
