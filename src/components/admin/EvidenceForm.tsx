"use client";

import { useActionState, useState } from "react";
import { addEvidence, type EvState } from "@/app/(app)/admin/evidence/actions";
import { CourseCoverField } from "@/components/classroom/CourseCoverField";
import { RANKS, STORY_TYPES } from "@/lib/resources/kinds";

const initial: EvState = { error: "", done: "" };

export function EvidenceForm() {
  const [state, action, pending] = useActionState(addEvidence, initial);
  const [photo, setPhoto] = useState("");
  return (
    <form action={action} className="admin-form" style={{ maxWidth: 600 }}>
      <input type="hidden" name="photo_url" value={photo} />
      <CourseCoverField value={photo} onChange={setPhoto} idPrefix="ev" />
      <div className="field"><label htmlFor="ev-name">Name</label><input id="ev-name" name="name" maxLength={120} required /></div>
      <div className="field"><label htmlFor="ev-rank-a">Top rank</label>
        <select id="ev-rank-a" name="rank" defaultValue="" required><option value="" disabled>Choose a rank</option>{RANKS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
      <div className="field"><label htmlFor="ev-type">Kind of story (so people can sort by it)</label>
        <select id="ev-type" name="story_type" defaultValue="" required><option value="" disabled>Choose one</option>{STORY_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      <div className="field"><label htmlFor="ev-story-a">Their story</label><textarea id="ev-story-a" name="story" rows={7} maxLength={6000} required /></div>
      {state.error ? <p className="err" role="alert">{state.error}</p> : null}
      {state.done ? <p className="ok" role="status">{state.done}</p> : null}
      <div className="actions" style={{ marginTop: 0 }}><button className="btn primary" type="submit" disabled={pending}>{pending ? "Adding…" : "Add to the Evidence Manual"}</button></div>
    </form>
  );
}
