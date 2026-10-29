"use client";

import { useActionState, useState, useTransition } from "react";
import { removeListing, saveListing, type ListingState } from "@/app/(app)/outsourcing/actions";
import type { MyListing } from "@/lib/outsourcing/queries";
import { OFFERINGS, VA_LENGTHS } from "@/lib/outsourcing/tasks";

export function ListingForm({ mine }: { mine: MyListing | null }) {
  const [state, action, pending] = useActionState(saveListing, { error: "" } as ListingState);
  const [open, setOpen] = useState(false);
  const [removing, startRemove] = useTransition();
  const [va, setVa] = useState<"yes" | "no" | "">(mine?.va_experience === true ? "yes" : mine?.va_experience === false ? "no" : "");
  const show = open || !mine;
  if (!show) {
    return (
      <section className="card-s">
        <h2 className="qh" style={{ marginTop: 0 }}>Your listing</h2>
        <p style={{ margin: "0 0 4px" }}><strong>{mine!.tasks.join(", ")}</strong> · ${(mine!.hourly_rate_cents / 100).toFixed(2)}/hour</p>
        <p className="when" style={{ margin: "0 0 12px" }}>{mine!.listed ? "People can find you in the list below." : "You are hidden from the list right now."}</p>
        <div className="set-actions">
          <button className="btn" type="button" onClick={() => setOpen(true)}>Edit my listing</button>
          <button className="linkbtn danger" type="button" disabled={removing} onClick={() => { if (window.confirm("Remove your listing?")) startRemove(async () => { await removeListing(); }); }}>Remove</button>
        </div>
      </section>
    );
  }
  return (
    <form action={action} className="set-form card-s">
      <h2 className="qh" style={{ margin: 0 }}>{mine ? "Edit your listing" : "Offer your services"}</h2>
      <fieldset className="offer-pick">
        <legend>What are you offering? (choose all that apply)</legend>
        {OFFERINGS.map((o) => <label key={o} className="check"><input type="checkbox" name="tasks" value={o} defaultChecked={mine?.tasks.includes(o)} /> {o}</label>)}
      </fieldset>
      <div className="va-row">
        <span id="va-label" className="va-label">Do you have experience as a VA (virtual assistant)?</span>
        <div className="va-choices" role="radiogroup" aria-labelledby="va-label">
          <label className="check"><input type="radio" name="va" value="yes" required checked={va === "yes"} onChange={() => setVa("yes")} /> Yes</label>
          <label className="check"><input type="radio" name="va" value="no" checked={va === "no"} onChange={() => setVa("no")} /> No</label>
        </div>
        {va === "yes" ? (
          <div className="va-length"><label htmlFor="o-vl">For how long?</label>
            <select id="o-vl" name="va_length" required defaultValue={mine?.va_experience_length ?? ""}>
              <option value="" disabled>Choose one</option>
              {VA_LENGTHS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select></div>
        ) : null}
      </div>
      <div className="row">
        <div className="field"><label htmlFor="o-r">Hourly rate (USD)</label><input id="o-r" name="rate" type="text" inputMode="decimal" required defaultValue={mine ? (mine.hourly_rate_cents / 100).toFixed(2) : ""} placeholder="35.00" /></div>
      </div>
      <div className="field"><label htmlFor="o-a">Is there anything else you&apos;d like the community to know?</label><textarea id="o-a" name="about" rows={4} maxLength={1500} defaultValue={mine?.about ?? ""} /></div>
      <label className="check"><input type="checkbox" name="listed" defaultChecked={mine?.listed ?? true} /> Show me in the list</label>
      <div className="set-actions">
        <button className="btn primary" type="submit" disabled={pending}>{pending ? "Saving…" : "Save listing"}</button>
        {mine ? <button className="linkbtn" type="button" onClick={() => setOpen(false)}>Cancel</button> : null}
        <span role="status" className="when">{state.saved ? "Saved." : ""}</span>
      </div>
      <p className="err" role="alert">{state.error}</p>
    </form>
  );
}
