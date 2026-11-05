"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { addCheck, addToTeam, deleteCheck, inviteTeamMember, setCallPlan, teamLeadOptions, type LeadOption, deleteTeamMember, logCheckIn, setTeamRank, setTeamStatus, toggleCheck } from "@/app/(app)/tracking/actions";
import { LeadCombo, NOT_IN_PORTAL } from "./LeadCombo";
import { TEAM_RANKS, type TeamCheck, type TeamMember, type TeamStatus } from "@/lib/tracking/types";

type Res = { ok: true; team: TeamMember[] } | { ok: false; error: string };
const STATUS_TEXT: Record<TeamStatus, string> = { active: "Active in FLC", registered: "In the portal, choosing a plan", invited: "Invited, waiting for them to sign up", not_in_portal: "Not in the portal", left: "No longer in the portal", inactive: "Not working their business" };
const day = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));

/** What the system ticks by itself, from how far they are in the Business Launch Course. */
function autoDone(m: TeamMember, kind: TeamCheck["kind"]): boolean | null {
  if (kind === "course_started") return m.started;
  if (kind === "course_half") return m.totalLessons > 0 && m.doneLessons * 2 >= m.totalLessons;
  if (kind === "course_done") return m.totalLessons > 0 && m.doneLessons >= m.totalLessons;
  return null;
}

function Label({ c, teamChat }: { c: TeamCheck; teamChat: string | null }) {
  const link = (phrase: string, href: string | null) => {
    const i = c.label.indexOf(phrase);
    if (i < 0 || !href) return <>{c.label}</>;
    return <>{c.label.slice(0, i)}<Link href={href}>{phrase}</Link>{c.label.slice(i + phrase.length)}</>;
  };
  if (c.kind === "graphic") return link("Graphic Maker", "/graphic-maker");
  if (c.kind === "welcome_chat") return link("New Members Discussion Chat", "/chats/welcome-discussion");
  if (c.kind === "team_chat") return link("my team chat", teamChat);
  return <>{c.label}</>;
}

/** The team, A to Z. Each name opens a check-in list with tick boxes. */
export function TeamView({ initial, openId, ask, teamChat }: { initial: TeamMember[]; openId?: string; ask?: boolean; teamChat: string | null }) {
  const [team, setTeam] = useState(initial);
  const [open, setOpen] = useState<Set<string>>(new Set(openId ? [openId] : []));
  const [rank, setRank] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [options, setOptions] = useState<LeadOption[] | null>(null);
  const [pickKey, setPickKey] = useState("");
  const [nv, setNv] = useState({ name: "", email: "", rank: "1A" });
  const [notice, setNotice] = useState("");
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Record<string, string>>({});
  /* the question that opens right after someone is marked as affiliated: who takes their leads' coaching calls? */
  const [planFor, setPlanFor] = useState<string | null>(ask && openId && initial.some((m) => m.id === openId && !m.callsMode) ? openId : null);
  const [planMode, setPlanMode] = useState<"" | "for" | "together">("");
  const [planHow, setPlanHow] = useState<"always" | "until">("always");
  const [planRank, setPlanRank] = useState<string>("6A2");
  const planDlg = useRef<HTMLDialogElement | null>(null);
  const setPlanDlg = (el: HTMLDialogElement | null) => { planDlg.current = el; if (el && planFor && !el.open) el.showModal(); };
  const planMember = team.find((m) => m.id === planFor) ?? null;
  const closePlan = () => { planDlg.current?.close(); setPlanFor(null); setPlanMode(""); setPlanHow("always"); };
  const savePlan = (mode: "" | "for" | "together") => {
    if (!planFor) return;
    run(() => setCallPlan(planFor, mode, mode && planHow === "until" ? planRank : ""), closePlan);
  };

  const run = (fn: () => Promise<Res>, after?: () => void) => start(async () => { const r = await fn(); if (r.ok) { setTeam(r.team); setError(""); after?.(); } else setError(r.error); });
  const toggleOpen = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const shown = team.filter((m) => !rank || m.rank === rank);

  return (
    <div className="tm">
      <div className="tm-top">
        <div className="field"><label htmlFor="tm-rank">Show only this rank</label>
          <select id="tm-rank" value={rank} onChange={(e) => setRank(e.target.value)}><option value="">Everyone ({team.length})</option>{TEAM_RANKS.map((r) => <option key={r} value={r}>{r} ({team.filter((m) => m.rank === r).length})</option>)}</select></div>
        <button type="button" className="btn" onClick={() => { const next = !adding; setAdding(next); setNotice(""); if (next && options === null) void teamLeadOptions().then(setOptions).catch(() => setOptions([])); }}>{adding ? "Close" : "Add a team member"}</button>
      </div>
      {adding ? (
        <div className="card-s tm-add">
          <LeadCombo label="Choose one of your leads" options={options ?? []} value={pickKey} onChange={setPickKey} />
          {pickKey === NOT_IN_PORTAL ? (
            <>
              <div className="field"><label htmlFor="tm-n">Their name</label><input id="tm-n" value={nv.name} maxLength={80} onChange={(e) => setNv({ ...nv, name: e.target.value })} /></div>
              <div className="field"><label htmlFor="tm-e">Their email</label><input id="tm-e" type="email" value={nv.email} onChange={(e) => setNv({ ...nv, email: e.target.value })} /></div>
              <p className="when" style={{ margin: 0 }}>We will email them an invitation to create their account in the FLC Portal.</p>
            </>
          ) : pickKey ? <p className="when" style={{ margin: 0 }}>If they are not in the portal yet, we will email them an invitation to create their account.</p> : null}
          <div className="field"><label htmlFor="tm-r">Their rank</label><select id="tm-r" value={nv.rank} onChange={(e) => setNv({ ...nv, rank: e.target.value })}>{TEAM_RANKS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
          <button type="button" className="btn primary" disabled={pending || !pickKey || (pickKey === NOT_IN_PORTAL && (!nv.name.trim() || !nv.email.trim()))} onClick={() => {
            const o = (options ?? []).find((x) => x.key === pickKey);
            const body = pickKey === NOT_IN_PORTAL ? { name: nv.name, email: nv.email, rank: nv.rank } : { name: o?.name ?? "", email: o?.email ?? "", cardId: o?.cardId ?? null, rank: nv.rank };
            start(async () => {
              const r = await addToTeam(body);
              if (r.ok) { setTeam(r.team); setNotice(r.message); setError(""); setPickKey(""); setNv({ name: "", email: "", rank: "1A" }); setAdding(false); setOptions(null); } else setError(r.error);
            });
          }}>Add to my team</button>
        </div>
      ) : null}
      {notice ? <p className="ok" role="status">{notice}</p> : null}
      {error ? <p className="err" role="alert">{error}</p> : null}
      {shown.length === 0 ? <p className="card-s" style={{ margin: 0 }}>{team.length === 0 ? "Nobody yet. When you press “Affiliated” on a lead in Lead Tracking, they show up here." : "No one is at that rank."}</p> : (
        <ul className="tm-list">
          {shown.map((m) => {
            const isOpen = open.has(m.id);
            const doneCount = m.checks.filter((c) => (autoDone(m, c.kind) ?? c.done)).length;
            return (
              <li key={m.id} className="tm-item">
                <div className="tm-row">
                  <button type="button" className="tm-name" aria-expanded={isOpen} onClick={() => toggleOpen(m.id)}><span aria-hidden="true">{isOpen ? "▾" : "▸"}</span> <span translate="no">{m.name}</span></button>
                  <span className={"tm-status s-" + m.status}>{STATUS_TEXT[m.status]}</span>
                  <span className="tm-rankpick">
                    <label className="sr-only" htmlFor={`rk-${m.id}`}>Rank for {m.name}</label>
                    <select id={`rk-${m.id}`} value={m.rank} onChange={(e) => run(() => setTeamRank(m.id, e.target.value))}>{TEAM_RANKS.map((r) => <option key={r} value={r}>{r}</option>)}</select>
                  </span>
                  <span className="tm-last">{m.lastCheckIn ? <>Last check-in: {day(m.lastCheckIn)}{m.lastNote ? <> · <span translate="no">{m.lastNote}</span></> : null}</> : "No check-ins yet"}</span>
                </div>
                {isOpen ? (
                  <div className="tm-body">
                    <p className="when" style={{ margin: "0 0 8px" }}>{doneCount} of {m.checks.length} done{m.email ? <> · <span translate="no">{m.email}</span></> : null}</p>
                    <p className="when" style={{ margin: "0 0 8px" }}>
                      Coaching calls for their leads: <strong>{m.callsMode === "for" ? "I take them for them" : m.callsMode === "together" ? "I take them together with them" : "They take their own"}</strong>
                      {m.callsMode ? (m.callsUntil ? ` until they reach ${m.callsUntil}` : ", indefinitely") : ""}{" "}
                      <button type="button" className="linkbtn" style={{ padding: 0 }} onClick={() => { setPlanMode(m.callsMode ?? ""); setPlanHow(m.callsUntil ? "until" : "always"); setPlanRank(m.callsUntil ?? "6A2"); setPlanFor(m.id); }}>Change</button>
                    </p>
                    <ul className="tm-checks">
                      {m.checks.map((c) => {
                        const auto = autoDone(m, c.kind);
                        const checked = auto ?? c.done;
                        return (
                          <li key={c.id}>
                            <label className="check" style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                              <input type="checkbox" checked={checked} disabled={auto !== null || pending} onChange={(e) => run(() => toggleCheck(c.id, e.target.checked))} />
                              <span><Label c={c} teamChat={teamChat} />{auto !== null ? <span className="muted-line"> (ticks automatically{m.totalLessons === 0 ? " once the course is set up" : ""})</span> : null}
                                {c.kind === "team_chat" && !teamChat ? <span className="muted-line"> (create a group chat with “team” in its name and this links to it)</span> : null}</span>
                            </label>
                            {c.kind === "manual" ? <button type="button" className="linkbtn tm-x" aria-label={`Remove: ${c.label}`} onClick={() => run(() => deleteCheck(c.id))}>×</button> : null}
                          </li>
                        );
                      })}
                    </ul>
                    <form className="tm-addcheck" onSubmit={(e) => { e.preventDefault(); const v = extra[m.id] ?? ""; if (v.trim()) run(() => addCheck(m.id, v), () => setExtra((s) => ({ ...s, [m.id]: "" }))); }}>
                      <input aria-label="Add your own check-in" placeholder="Add your own check-in to this list…" value={extra[m.id] ?? ""} maxLength={200} onChange={(e) => setExtra((s) => ({ ...s, [m.id]: e.target.value }))} />
                      <button type="submit" className="btn small" disabled={pending}>Add</button>
                    </form>
                    <form className="tm-addcheck" onSubmit={(e) => { e.preventDefault(); run(() => logCheckIn(m.id, note[m.id] ?? ""), () => setNote((s) => ({ ...s, [m.id]: "" }))); }}>
                      <input aria-label="Note about today's check-in" placeholder="Checked in today? Add a short note (optional)" value={note[m.id] ?? ""} maxLength={200} onChange={(e) => setNote((s) => ({ ...s, [m.id]: e.target.value }))} />
                      <button type="submit" className="btn small" disabled={pending}>Log a check-in</button>
                    </form>
                    <div className="tm-foot">
                      <label className="sr-only" htmlFor={`st-${m.id}`}>Status for {m.name}</label>
                      <select id={`st-${m.id}`} value={m.status === "left" || m.status === "inactive" ? m.status : ""} onChange={(e) => run(() => setTeamStatus(m.id, e.target.value))}>
                        <option value="">Status: worked out automatically</option><option value="left">Mark as no longer in the portal</option><option value="inactive">Mark as not working their business</option>
                      </select>
                      {m.status === "not_in_portal" && m.email ? <button type="button" className="linkbtn" disabled={pending} onClick={() => start(async () => { const r = await inviteTeamMember(m.id); if (r.ok) { setTeam(r.team); setNotice(r.message); setError(""); } else setError(r.error); })}>Invite them to the portal</button> : null}
                      <button type="button" className="linkbtn" onClick={() => { if (window.confirm(`Remove ${m.name} from your team list?`)) run(() => deleteTeamMember(m.id)); }}>Remove from my team</button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {planFor && planMember ? (
        <dialog ref={setPlanDlg} className="rs-dialog" aria-labelledby="tm-plan-title" onClose={() => setPlanFor(null)}>
          <h2 id="tm-plan-title" className="qh" style={{ marginTop: 0 }}>Coaching calls</h2>
          <p>Will you be taking <strong translate="no">{planMember.name}</strong>&apos;s coaching calls for them or together with them?</p>
          <div className="tm-plan-modes">
            <button type="button" className={"btn" + (planMode === "for" ? " primary" : "")} onClick={() => setPlanMode("for")}>For them</button>
            <button type="button" className={"btn" + (planMode === "together" ? " primary" : "")} onClick={() => setPlanMode("together")}>Together with them</button>
          </div>
          {planMode ? (
            <fieldset className="tm-plan-how">
              <legend>For how long?</legend>
              <label className="check"><input type="radio" name="plan-how" checked={planHow === "always"} onChange={() => setPlanHow("always")} /> Indefinitely</label>
              <label className="check"><input type="radio" name="plan-how" checked={planHow === "until"} onChange={() => setPlanHow("until")} /> Until they reach a rank
                <select aria-label="Rank" value={planRank} disabled={planHow !== "until"} onChange={(e) => setPlanRank(e.target.value)} style={{ marginLeft: 8 }}>{TEAM_RANKS.filter((r) => r !== "1A").map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
            </fieldset>
          ) : null}
          <p className="when">Their leads will see your calendar when they book a call.</p>
          <div className="dlg-actions">
            <button type="button" className="btn" onClick={() => savePlan("")}>{planMember.callsMode ? "Stop taking them" : "Neither, they take their own"}</button>
            <button type="button" className="btn primary" disabled={!planMode || pending} onClick={() => savePlan(planMode)}>Save</button>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}
