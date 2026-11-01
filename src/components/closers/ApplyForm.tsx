"use client";

import { useActionState, useTransition } from "react";
import { applyAsCloser, withdrawApplication, type ApplyState } from "@/app/(app)/call-closers/actions";
import { EXPERIENCE, type Application } from "@/lib/closers/types";

/** The application to become a call closer, or where it stands. */
export function ApplyForm({ mine, isCloser }: { mine: Application | null; isCloser: boolean }) {
  const [state, action, pending] = useActionState(applyAsCloser, { error: "" } as ApplyState);
  const [withdrawing, start] = useTransition();
  if (isCloser) return <section className="card-s"><h2 className="qh" style={{ marginTop: 0 }}>You are a call closer</h2><p style={{ margin: 0 }}>You are listed above. To change your price or details, ask an admin.</p></section>;
  if (mine?.status === "pending" || state.sent) {
    return (
      <section className="card-s">
        <h2 className="qh" style={{ marginTop: 0 }}>Your application is in</h2>
        <p style={{ margin: "0 0 12px" }}>An admin will look at it soon, and you will get a notification either way.</p>
        {mine?.status === "pending" ? <button type="button" className="btn small" disabled={withdrawing} onClick={() => start(async () => { await withdrawApplication(mine.id); })}>Take back my application</button> : null}
      </section>
    );
  }
  return (
    <section className="card-s" aria-label="Apply to become a call closer">
      <h2 className="qh" style={{ marginTop: 0 }}>Become a call closer</h2>
      <p className="when" style={{ marginTop: 0 }}>Call closers take sales calls for other affiliates&rsquo; leads. Tell us about you and an admin will review it.</p>
      {mine?.status === "declined" ? <p className="err" style={{ minHeight: 0 }}>Your last application was not accepted. You are welcome to apply again.{mine.review_note ? <><br />{`Note from the admin: ${mine.review_note}`}</> : null}</p> : null}
      <form action={action} className="set-form">
        <div className="field"><label htmlFor="ca-exp">How much experience do you have with sales calls?</label>
          <select id="ca-exp" name="experience" required defaultValue=""><option value="" disabled>Choose one</option>{EXPERIENCE.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
        <div className="field"><label htmlFor="ca-calls">About how many calls have you taken? (optional)</label><input id="ca-calls" name="calls_taken" type="text" maxLength={40} placeholder="e.g. 50+" /></div>
        <div className="field"><label htmlFor="ca-avail">When are you available?</label><textarea id="ca-avail" name="availability" required maxLength={400} rows={3} placeholder="Days, times and your time zone" /></div>
        <div className="field"><label htmlFor="ca-pitch">Why would you be a great call closer?</label><textarea id="ca-pitch" name="pitch" required maxLength={1500} rows={5} placeholder="Your story, your style and what people can expect from a call with you" /></div>
        <div className="row">
          <div className="field"><label htmlFor="ca-pc">Your price per call (USD, optional)</label><input id="ca-pc" name="price_per_call" type="text" inputMode="decimal" placeholder="e.g. 50" /></div>
          <div className="field"><label htmlFor="ca-ps">Your charge per product sale (USD, optional)</label><input id="ca-ps" name="price_per_sale" type="text" maxLength={400} placeholder="e.g. 1A-3A = $50, 4A+ = 8% of total sales" /></div>
        </div>
        <label className="check" style={{ display: "flex", gap: 10, alignItems: "flex-start" }}><input type="checkbox" name="agreed" style={{ marginTop: 4 }} />
          <span>I agree to the community rules, including the strict policy against lead poaching, and I understand an admin can remove me from the list.</span></label>
        <div className="set-actions"><button className="btn primary" type="submit" disabled={pending}>{pending ? "Sending…" : "Send my application"}</button></div>
        <p className="err" role="alert">{state.error}</p>
      </form>
    </section>
  );
}
