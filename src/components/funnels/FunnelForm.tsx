"use client";

import { useState, useTransition } from "react";
import { submitFunnelForm } from "@/app/f/actions";
import { FIELD_LABELS, type El, type FormField } from "@/lib/funnels/types";

const TYPES: Record<FormField, string> = { first_name: "text", last_name: "text", email: "email", phone: "tel" };
const AUTO: Record<FormField, string> = { first_name: "given-name", last_name: "family-name", email: "email", phone: "tel" };

/** A form on a live funnel page: sends what was typed to the funnel's owner, then goes on to the next step. */
export function FunnelForm({ el, funnelId, stepId, next }: { el: El; funnelId: string; stepId: string; next: string | null }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const fields = el.props.fields ?? ["email"];
  return done && !next ? (
    <p className="fn-done" role="status">Thank you! We have your details.</p>
  ) : (
    <form className="fn-form" onSubmit={(e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
      setError("");
      start(async () => {
        const r = await submitFunnelForm(funnelId, stepId, data);
        if (!r.ok) { setError("Please check your details and try again."); return; }
        if (next) window.location.assign(next); else setDone(true);
      });
    }}>
      {fields.map((f) => (
        <input key={f} className="fn-input" name={f} type={TYPES[f]} autoComplete={AUTO[f]} placeholder={FIELD_LABELS[f]} aria-label={FIELD_LABELS[f]} required={f === "email"} />
      ))}
      <button type="submit" className="fn-btn" disabled={pending} style={{ background: el.props.buttonColor ?? "#8C6F5E", color: el.props.buttonTextColor ?? "#fff", borderRadius: el.style.radius ?? 10 }}>{el.props.buttonText ?? "Submit"}</button>
      {error ? <p className="fn-error" role="alert">{error}</p> : null}
    </form>
  );
}
