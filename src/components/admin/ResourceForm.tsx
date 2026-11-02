"use client";

import { useActionState } from "react";
import { addResource } from "@/app/(app)/admin/support/actions";
import { KIND_LABEL, RESOURCE_KINDS } from "@/lib/support/types";

export function ResourceForm() {
  const [state, run, pending] = useActionState(addResource, { error: "", done: "" });
  return (
    <form action={run} className="admin-form" noValidate key={state.done}>
      <div className="row">
        <div className="field"><label htmlFor="sr-kind">What is it?</label>
          <select id="sr-kind" name="kind" defaultValue="website">{RESOURCE_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></div>
        <div className="field"><label htmlFor="sr-title">Title</label><input id="sr-title" name="title" type="text" maxLength={160} required /></div>
      </div>
      <div className="field"><label htmlFor="sr-url">Link (optional, must start with https://)</label><input id="sr-url" name="url" type="url" /></div>
      <div className="field"><label htmlFor="sr-desc">Why it helps (optional)</label><input id="sr-desc" name="description" type="text" maxLength={600} /></div>
      <div className="field"><label htmlFor="sr-kw">Extra words that should find it (optional)</label><input id="sr-kw" name="keywords" type="text" maxLength={600} placeholder="stuck, discouraged, no leads, motivation, consistency" /></div>
      <div className="row">
        <label className="check"><input type="checkbox" name="for_leads" /> Show to leads too</label>
        <label className="check"><input type="checkbox" name="for_downline" /> Show to Lacey&apos;s downline too</label>
      </div>
      <p className={"status" + (state.error ? " bad" : state.done ? " ok" : "")} role="status">{state.error || state.done}</p>
      <div className="actions" style={{ marginTop: 0 }}><button className="btn primary" type="submit" disabled={pending}>{pending ? "Adding…" : "Add to the library"}</button></div>
    </form>
  );
}
