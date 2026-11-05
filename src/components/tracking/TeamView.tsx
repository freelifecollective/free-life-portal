"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addCheck, addTeamMember, deleteCheck, deleteTeamMember, logCheckIn, setTeamRank, setTeamStatus, toggleCheck } from "@/app/(app)/tracking/actions";
import { TEAM_RANKS, type TeamCheck, type TeamMember, type TeamStatus } from "@/lib/tracking/types";

type Res = { ok: true; team: TeamMember[] } | { ok: false; error: string };
const STATUS_TEXT: Record<TeamStatus, string> = { active: "Active in FLC", not_in_portal: "Not in the portal", left: "No longer in the portal", inactive: "Not working their business" };
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
export function TeamView({ initial, openId, teamChat }: { initial: TeamMember[]; openId?: string; teamChat: string | null }) {
  const [team, setTeam] = useState(initial);
  const [open, setOpen] = useState<Set<string>>(new Set(openId ? [openId] : []));
  const [rank, setRank] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [nv, setNv] = useState({ name: "", email: "", rank: "New" });
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Record<string, string>>({});

  const run = (fn: () => Promise<Res>, after?: () => void) => start(async () => { const r = await fn(); if (r.ok) { setTeam(r.team); setError(""); after?.(); } else setError(r.error); });
  const toggleOpen = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const shown = team.filter((m) => !rank || m.rank === rank);

  return (
    <div className="tm">
      <div className="tm-top">
        <div className="field"><label htmlFor="tm-rank">Show only this rank</label>
          <select id="tm-rank" value={rank} onChange={(e) => setRank(e.target.value)}><option value="">Everyone ({team.length})</option>{TEAM_RANKS.map((r) => <option key={r} value={r}>{r} ({team.filter((m) => m.rank === r).length})</option>)}</select></div>
        <button type="button" className="btn" onClick={() => setAdding(!adding)}>{adding ? "Close" : "Add a team member"}</button>
      </div>
      {adding ? (
        <div className="card-s tm-add">
          <div className="field"><label htmlFor="tm-n">Name</label><input id="tm-n" value={nv.name} maxLength={80} onChange={(e) => setNv({ ...nv, name: e.target.value })} /></div>
          <div className="field"><label htmlFor="tm-e">Their email (links them to their portal account)</label><input id="tm-e" type="email" value={nv.email} onChange={(e) => setNv({ ...nv, email: e.target.value })} /></div>
          <div className="field"><label htmlFor="tm-r">Rank</label><select id="tm-r" value={nv.rank} onChange={(e) => setNv({ ...nv, rank: e.target.value })}>{TEAM_RANKS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
          <button type="button" className="btn primary" disabled={pending} onClick={() => run(() => addTeamMember(nv), () => { setNv({ name: "", email: "", rank: "New" }); setAdding(false); })}>Add</button>
        </div>
      ) : null}
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
                      <button type="button" className="linkbtn" onClick={() => { if (window.confirm(`Remove ${m.name} from your team list?`)) run(() => deleteTeamMember(m.id)); }}>Remove from my team</button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
