"use client";

import { useActionState, useState } from "react";
import type { CallFormState } from "@/app/(app)/admin/calls/actions";
import { SpeakersField, type SpeakerValue } from "./SpeakersField";
import { AUDIENCE_LABEL, KIND_LABEL, defaultAudience, type Audience, type CallKind } from "@/lib/calls/types";

export type CallFormValues = {
  title: string; kind: CallKind; audience: Audience; starts: string; duration: number; description: string; join_url: string; host: string; pinned: boolean; speakers: SpeakerValue[];
};
export const EMPTY_CALL: CallFormValues = { title: "", kind: "community", audience: "leads_open", starts: "", duration: 60, description: "", join_url: "", host: "", pinned: false, speakers: [] };

export function CallForm({ action, initial = EMPTY_CALL, submitLabel }: {
  action: (prev: CallFormState, form: FormData) => Promise<CallFormState>; initial?: CallFormValues; submitLabel: string;
}) {
  const [state, run, pending] = useActionState(action, { error: "" });
  const [kind, setKind] = useState<CallKind>(initial.kind);
  const [audience, setAudience] = useState<Audience>(initial.audience);

  return (
    <form action={run} className="admin-form" noValidate>
      <div className="field"><label htmlFor="title">Title</label>
        <input id="title" name="title" type="text" maxLength={120} required defaultValue={initial.title} placeholder="Weekly community call" /></div>
      <div className="field"><label htmlFor="host">Who is leading the call</label>
        <input id="host" name="host" type="text" maxLength={80} defaultValue={initial.host} placeholder="Sonya Fruthven" /></div>
      <SpeakersField initial={initial.speakers} />
      <div className="row">
        <div className="field"><label htmlFor="kind">Kind of call</label>
          <select id="kind" name="kind" value={kind} onChange={(e) => { const k = e.target.value as CallKind; setKind(k); setAudience(defaultAudience(k)); }}>
            {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select></div>
        <div className="field"><label htmlFor="audience">Who can see it</label>
          <select id="audience" name="audience" value={audience} onChange={(e) => setAudience(e.target.value as Audience)}>
            {Object.entries(AUDIENCE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select></div>
      </div>
      <div className="row">
        <div className="field"><label htmlFor="starts">Starts (Eastern time)</label>
          <input id="starts" name="starts" type="datetime-local" required defaultValue={initial.starts} /></div>
        <div className="field"><label htmlFor="duration">Length in minutes</label>
          <input id="duration" name="duration" type="number" min={15} max={480} step={5} required defaultValue={initial.duration} /></div>
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
