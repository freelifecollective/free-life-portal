"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteAutomation, saveAutomation } from "@/app/(app)/advertising/funnels/messages-actions";

export type Auto = { id: string; name: string; funnel_id: string | null; active: boolean; steps: { wait_hours: number; message_id: string }[] };
type Opt = { id: string; name: string };
type MsgOpt = Opt & { kind: "email" | "text" };

type Draft = { id?: string; name: string; funnel_id: string | null; active: boolean; steps: { wait: number; unit: "hours" | "days"; message_id: string }[] };
const toDraft = (a: Auto): Draft => ({ id: a.id, name: a.name, funnel_id: a.funnel_id, active: a.active, steps: a.steps.map((s) => (s.wait_hours % 24 === 0 && s.wait_hours > 0 ? { wait: s.wait_hours / 24, unit: "days" as const, message_id: s.message_id } : { wait: s.wait_hours, unit: "hours" as const, message_id: s.message_id })) });

function Editor({ draft: initial, funnels, messages, onDone }: { draft: Draft; funnels: Opt[]; messages: MsgOpt[]; onDone: () => void }) {
  const router = useRouter();
  const [d, setD] = useState(initial);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const setStep = (i: number, change: Partial<Draft["steps"][number]>) => setD({ ...d, steps: d.steps.map((s, k) => (k === i ? { ...s, ...change } : s)) });
  return (
    <form className="au-editor" onSubmit={(e) => {
      e.preventDefault(); setErr("");
      start(async () => {
        const r = await saveAutomation({ id: d.id, name: d.name, funnel_id: d.funnel_id, active: d.active, steps: d.steps.map((s) => ({ wait_hours: s.unit === "days" ? s.wait * 24 : s.wait, message_id: s.message_id })) });
        if (r.ok) { onDone(); router.refresh(); } else setErr(r.error ?? "Something went wrong.");
      });
    }}>
      <div className="field"><label htmlFor="au-name">Name</label><input id="au-name" type="text" maxLength={80} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></div>
      <div className="field"><label htmlFor="au-when">Starts when someone fills in a form on</label>
        <select id="au-when" value={d.funnel_id ?? ""} onChange={(e) => setD({ ...d, funnel_id: e.target.value || null })}>
          <option value="">Any of my funnels</option>
          {funnels.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>
      <ol className="au-steps">
        {d.steps.map((s, i) => (
          <li key={i} className="au-step">
            <span>Wait</span>
            <input type="number" min={0} max={s.unit === "days" ? 365 : 8760} value={s.wait} aria-label="How long to wait" onChange={(e) => setStep(i, { wait: Math.max(0, Number(e.target.value) || 0) })} />
            <select value={s.unit} aria-label="Hours or days" onChange={(e) => setStep(i, { unit: e.target.value as "hours" | "days" })}><option value="hours">hours</option><option value="days">days</option></select>
            <span>then send</span>
            <select value={s.message_id} aria-label="Which email or text" onChange={(e) => setStep(i, { message_id: e.target.value })}>
              <option value="">Choose…</option>
              <optgroup label="Emails">{messages.filter((m) => m.kind === "email").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>
              <optgroup label="Texts">{messages.filter((m) => m.kind === "text").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>
            </select>
            <button type="button" className="linkbtn danger" aria-label="Remove this step" onClick={() => setD({ ...d, steps: d.steps.filter((_, k) => k !== i) })}>Remove</button>
          </li>
        ))}
      </ol>
      <button type="button" className="btn small" onClick={() => setD({ ...d, steps: [...d.steps, { wait: d.steps.length ? 1 : 0, unit: "days", message_id: "" }] })}>+ Add a step</button>
      <label className="check-inline"><input type="checkbox" checked={d.active} onChange={(e) => setD({ ...d, active: e.target.checked })} /> Switched on</label>
      <div className="mv-actions"><button type="submit" className="btn primary small" disabled={pending}>Save automation</button><button type="button" className="linkbtn" onClick={onDone}>Cancel</button></div>
      {err ? <p className="status bad" role="alert">{err}</p> : null}
    </form>
  );
}

/** The member's automations: emails and texts sent on their own after someone fills in a form. */
export function AutomationsView({ automations, funnels, messages }: { automations: Auto[]; funnels: Opt[]; messages: MsgOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const funnelName = (id: string | null) => (id ? funnels.find((f) => f.id === id)?.name ?? "a funnel" : "any of my funnels");
  const msgName = (id: string) => messages.find((m) => m.id === id)?.name ?? "(deleted)";
  const when = (h: number) => (h === 0 ? "right away" : h % 24 === 0 ? `after ${h / 24} day${h === 24 ? "" : "s"}` : `after ${h} hour${h === 1 ? "" : "s"}`);
  if (!messages.length) return <p className="card-s" style={{ margin: 0 }}>First add an email or a text under <Link href="/advertising/funnels/emails">Emails</Link>. Then come back to choose when it is sent.</p>;
  return (
    <div className="mv">
      <div className="mv-head"><h2 className="qh">Your automations</h2>{open !== "new" ? <button type="button" className="btn small" onClick={() => setOpen("new")}>+ New automation</button> : null}</div>
      {open === "new" ? <Editor draft={{ name: "", funnel_id: null, active: true, steps: [{ wait: 0, unit: "hours", message_id: "" }] }} funnels={funnels} messages={messages} onDone={() => setOpen(null)} /> : null}
      {automations.length === 0 && open !== "new" ? <p className="when">No automations yet.</p> : null}
      <ul className="mv-list">
        {automations.map((a) => (
          <li key={a.id} className="mv-item">
            {open === a.id ? <Editor draft={toDraft(a)} funnels={funnels} messages={messages} onDone={() => setOpen(null)} /> : (
              <>
                <div className="mv-text">
                  <div><b translate="no">{a.name}</b> <span className={"au-on" + (a.active ? "" : " off")}>{a.active ? "On" : "Off"}</span></div>
                  <span>{`When someone fills in a form on ${funnelName(a.funnel_id)}:`}</span>
                  <ol className="au-summary">{a.steps.reduce<{ at: number; items: React.ReactNode[] }>((acc, s, i) => { acc.at += s.wait_hours; acc.items.push(<li key={i}>{`${when(acc.at)}, send `}<b translate="no">{msgName(s.message_id)}</b></li>); return acc; }, { at: 0, items: [] }).items}</ol>
                </div>
                <div className="mv-actions">
                  <button type="button" className="btn small" onClick={() => setOpen(a.id)}>Edit</button>
                  <button type="button" className="linkbtn danger" disabled={pending} onClick={() => { if (window.confirm(`Delete "${a.name}"?`)) start(async () => { await deleteAutomation(a.id); router.refresh(); }); }}>Delete</button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
