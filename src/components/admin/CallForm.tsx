"use client";

import { useActionState, useState } from "react";
import type { CallFormState } from "@/app/(app)/admin/calls/actions";
import { LENGTHS } from "@/lib/calls/length";
import { SpeakersField, type Affiliate, type SpeakerValue } from "./SpeakersField";
import { AUDIENCE_LABEL, DOWNLINE_LABEL, KIND_LABEL, SELECTABLE_KINDS, defaultAudience, type Audience, type CallKind } from "@/lib/calls/types";

export type CallFormValues = {
  title: string; kind: CallKind; audience: Audience; downline_open: boolean; starts: string; length: string; description: string; join_url: string; pinned: boolean; speakers: SpeakerValue[];
};
export const EMPTY_CALL: CallFormValues = { title: "", kind: "community", audience: "leads_open", downline_open: false, starts: "", length: "1h", description: "", join_url: "", pinned: false, speakers: [] };

export function CallForm({ action, initial = EMPTY_CALL, submitLabel, affiliates = [] }: {
  action: (prev: CallFormState, form: FormData) => Promise<CallFormState>; initial?: CallFormValues; submitLabel: string; affiliates?: Affiliate[];
}) {
  const [state, run, pending] = useActionState(action, { error: "" });
  const [kind, setKind] = useState<CallKind>(initial.kind);
  /* who can see it: leads and/or Lacey's downline, or FLC members only (FLC members always see every call) */
  const [who, setWho] = useState({ leads: initial.audience === "leads_open", downline: initial.downline_open, flc: initial.audience !== "leads_open" && !initial.downline_open });
  const setAudience = (a: Audience) => setWho({ leads: a === "leads_open", downline: false, flc: a === "affiliates_only" });
  const toggle = (k: "leads" | "downline" | "flc") => setWho((w) => {
    if (k === "flc") return { leads: false, downline: false, flc: true };
    const next = { ...w, [k]: !w[k], flc: false };
    return next.leads || next.downline ? next : { leads: false, downline: false, flc: true };
  });

  return (
    <form action={run} className="admin-form" noValidate>
      <div className="field"><label htmlFor="title">Title</label>
        <input id="title" name="title" type="text" maxLength={120} required defaultValue={initial.title} placeholder="Weekly community call" /></div>
      <SpeakersField initial={initial.speakers} affiliates={affiliates} />
      <div className="row">
        <div className="field"><label htmlFor="kind">Kind of call</label>
          <select id="kind" name="kind" value={kind} onChange={(e) => { const k = e.target.value as CallKind; setKind(k); setAudience(defaultAudience(k)); }}>
            {(initial.kind === "other" ? [...SELECTABLE_KINDS, "other" as CallKind] : SELECTABLE_KINDS).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select></div>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 600, marginBottom: 6 }}>Who can see it (pick one or more)</legend>
          <label className="check"><input type="checkbox" name="who" value="leads" checked={who.leads} onChange={() => toggle("leads")} /> {AUDIENCE_LABEL.leads_open}</label>
          <label className="check"><input type="checkbox" name="who" value="downline" checked={who.downline} onChange={() => toggle("downline")} /> {DOWNLINE_LABEL}</label>
          <label className="check"><input type="checkbox" name="who" value="flc" checked={who.flc} onChange={() => toggle("flc")} /> {AUDIENCE_LABEL.affiliates_only}</label>
        </fieldset>
      </div>
      <div className="row">
        <div className="field"><label htmlFor="starts">Starts (Eastern time)</label>
          <input id="starts" name="starts" type="datetime-local" required defaultValue={initial.starts} /></div>
        <div className="field"><label htmlFor="length">How long is the call?</label>
          <select id="length" name="length" required defaultValue={initial.length}>
            {initial.length === "keep" ? <option value="keep">Keep the current length</option> : null}
            {LENGTHS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select></div>
      </div>
      <div className="field"><label htmlFor="description">Description (optional)</label>
        <textarea id="description" name="description" rows={4} maxLength={2000} defaultValue={initial.description} placeholder="What the call is about, who is speaking…" /></div>
      <div className="field"><label htmlFor="join_url">Join link (optional, starts with https://)</label>
        <input id="join_url" name="join_url" type="text" inputMode="url" defaultValue={initial.join_url} placeholder="https://zoom.us/j/…" /></div>
      <label className="check"><input type="checkbox" name="pinned" defaultChecked={initial.pinned} /><span>Pin this call to the top of the calendar</span></label>
      <p className="err" role="alert">{state.error}</p>
      <div className="actions"><button className="btn primary" type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</button></div>
    </form>
  );
}
