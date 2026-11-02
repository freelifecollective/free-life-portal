"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { findSupport, type FocusState } from "@/app/(app)/support/actions";
import { openDockChat } from "@/components/messages/MessageDock";
import { GROUPS, hrefOf, KIND_LABEL, type ResourceKind, type SupportHit, type SupportPeople } from "@/lib/support/types";

const initial: FocusState = { q: "", hits: null, error: "", checkin: false, people: { coach: null, buddy: null } };

function Hit({ h }: { h: SupportHit }) {
  const href = hrefOf(h);
  const external = h.kind === "resource" && !!h.url;
  const title = <strong translate="no">{h.title}</strong>;
  return (
    <li className="card-s sup-hit">
      <div>
        {href ? (external ? <a href={href} target="_blank" rel="noopener noreferrer">{title}</a> : <Link href={href}>{title}</Link>) : title}
        {h.kind === "resource" && h.sub ? <span className="doc-tag" style={{ marginLeft: 8 }}>{KIND_LABEL[h.sub as ResourceKind] ?? "Other"}</span> : null}
        {h.blurb ? <p className="when" style={{ margin: "4px 0 0" }} translate="no">{h.blurb.length > 200 ? h.blurb.slice(0, 198) + "…" : h.blurb}</p> : null}
        {h.kind === "call" && h.at ? <p className="when" style={{ margin: "4px 0 0" }}>{new Date(h.at).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} Eastern</p> : null}
      </div>
    </li>
  );
}

/** A past call, shown with its picture. */
function CallCard({ h }: { h: SupportHit }) {
  return (
    <li className="rv-card">
      <Link href={`/calls/${h.id}`} className="rv-link">
        <span className="rv-thumb">
          {h.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={h.thumb} alt="" loading="lazy" />
          ) : <span className="rv-fallback" aria-hidden="true">▶</span>}
        </span>
        <span className="rv-body">
          <span className="rv-title" translate="no">{h.title}</span>
          {h.at ? <span className="rv-meta">{new Date(h.at).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" })}</span> : null}
        </span>
      </Link>
    </li>
  );
}

/** A recommended document, with its preview picture (or a plain icon when it has none). */
function DocCard({ h }: { h: SupportHit }) {
  const ext = h.title.includes(".") ? h.title.split(".").pop()!.slice(0, 4).toUpperCase() : "FILE";
  const mime = h.sub ?? "";
  const icon = mime.startsWith("audio/") ? "🎧" : mime.startsWith("video/") ? "🎬" : mime.includes("sheet") || mime.includes("excel") ? "📊" : mime.includes("presentation") || mime.includes("powerpoint") ? "📽️" : mime.includes("pdf") ? "📄" : "📎";
  return (
    <li className="doc-card">
      <Link href={hrefOf(h) ?? "/documents"} className="doc-card-main">
        {h.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="doc-cover" src={h.thumb} alt="" loading="lazy" />
        ) : <span className="doc-cover fallback"><span aria-hidden="true">{icon}</span><b>{ext}</b></span>}
        <span className="doc-card-name" translate="no">{h.title}</span>
      </Link>
    </li>
  );
}

function Results({ hits }: { hits: SupportHit[] }) {
  return GROUPS.map((g) => {
    const list = hits.filter((h) => h.kind === g.kind);
    if (!list.length) return null;
    return (
      <section key={g.kind}>
        <h2 className="qh">{g.title}</h2>
        {g.kind === "recording"
          ? <ul className="rv-grid sup-calls">{list.map((h) => <CallCard key={h.id} h={h} />)}</ul>
          : g.kind === "document"
          ? <ul className="doc-grid sup-docs">{list.map((h) => <DocCard key={h.id} h={h} />)}</ul>
          : <ul className="sup-list">{list.map((h) => <Hit key={h.kind + h.id} h={h} />)}</ul>}
      </section>
    );
  });
}

type Ans = "yes" | "no" | "skip" | null;

/** For a hard moment: have you reached out to your buddy or coach? */
function CheckIn({ people, buddy, coach, setBuddy, setCoach }: { people: SupportPeople; buddy: Ans; coach: Ans; setBuddy: (a: Ans) => void; setCoach: (a: Ans) => void }) {
  const row = (label: string, value: Ans, set: (a: Ans) => void) => (
    <div className="sup-q">
      <span>{label}</span>
      <span className="sup-yn" role="group" aria-label={label}>
        <button type="button" className={value === "yes" ? "on" : ""} aria-pressed={value === "yes"} onClick={() => set("yes")}>Yes</button>
        <button type="button" className={value === "no" ? "on" : ""} aria-pressed={value === "no"} onClick={() => set("no")}>No</button>
      </span>
    </div>
  );
  /* the buttons open a direct message with the right person straight away */
  const buddyBtn = people.buddy
    ? <button type="button" className="btn small primary" onClick={() => openDockChat(people.buddy!.id)}>Message accountability buddy</button>
    : <Link className="btn small" href="/buddy">Find an accountability buddy</Link>;
  const coachBtn = people.coach
    ? <button type="button" className="btn small primary" onClick={() => openDockChat(people.coach!.id)}>Message my coach</button>
    : <Link className="btn small" href="/settings#coach">Choose your coach</Link>;
  return (
    <section className="card-s sup-check">
      <h2 className="qh" style={{ marginTop: 0 }}>First, a quick check-in</h2>
      <p style={{ margin: "0 0 12px" }}>It sounds like this is a hard moment, and that is completely okay. Before anything else:</p>
      {row("Have you reached out to your accountability buddy?", buddy, setBuddy)}
      {row("Have you reached out to your coach?", coach, setCoach)}
      {buddy === "no" && coach === "no" ? (
        <div className="sup-reach" role="note">
          <p style={{ margin: "0 0 10px" }}><b>Please reach out to one of them first.</b> They want to hear from you, and a real conversation will do more than anything on this page.</p>
          <div className="rs-actions" style={{ marginTop: 0 }}>{buddyBtn}{coachBtn}</div>
        </div>
      ) : null}
      {buddy === "yes" && coach === "no" ? (
        <div className="sup-reach" role="note">
          <p style={{ margin: "0 0 10px" }}>That&apos;s great that you reached out to your accountability buddy! Maybe try talking to your coach as well. They want to help you!</p>
          <div className="rs-actions" style={{ marginTop: 0 }}>{coachBtn}</div>
        </div>
      ) : null}
      {coach === "yes" && buddy === "no" ? (
        <div className="sup-reach" role="note">
          <p style={{ margin: "0 0 10px" }}>That&apos;s great that you reached out to your coach! Maybe try talking to your accountability buddy as well. They want to help you!</p>
          <div className="rs-actions" style={{ marginTop: 0 }}>{buddyBtn}</div>
        </div>
      ) : null}
      {buddy === "yes" && coach === "yes" ? <p className="when" style={{ margin: "10px 0 0" }}>That is the best first step. Here are some things that may help too.</p> : null}
      {buddy === null || coach === null ? <p style={{ margin: "10px 0 0" }}><button type="button" className="linkbtn" onClick={() => { setBuddy("skip"); setCoach("skip"); }}>Just show me resources</button></p> : null}
    </section>
  );
}

/** "What is your focus this week?": type it in, and we suggest what can help. */
export function FocusForm() {
  const [state, action, pending] = useActionState(findSupport, initial);
  /* the check-in answers belong to one search: a new search starts them over */
  const [answers, setAnswers] = useState<{ q: string; buddy: Ans; coach: Ans }>({ q: "", buddy: null, coach: null });
  const mine = answers.q === state.q ? answers : { q: state.q, buddy: null as Ans, coach: null as Ans };
  const setBuddy = (a: Ans) => setAnswers({ ...mine, q: state.q, buddy: a });
  const setCoach = (a: Ans) => setAnswers({ ...mine, q: state.q, coach: a });
  const answered = mine.buddy !== null && mine.coach !== null;
  const showResults = !!state.hits && (!state.checkin || answered);
  const bothNo = state.checkin && mine.buddy === "no" && mine.coach === "no";
  return (
    <div className="sup">
      <form action={action} className="card-s sup-form">
        <label htmlFor="sup-q" className="sr-only">What is your focus this week?</label>
        <textarea id="sup-q" name="q" rows={3} maxLength={500} required placeholder="For example: following up with leads, handling objections, staying consistent…" defaultValue={state.q} />
        <div className="rs-actions" style={{ marginTop: 8 }}><button type="submit" className="btn primary" disabled={pending}>{pending ? "Looking…" : "Show me what can help"}</button></div>
        <p className="when" style={{ margin: "8px 0 0" }}>Whatever you type is completely anonymous, and no one will ever see that you typed it. Recurring questions get added as a suggestion to admins to help improve the system but no names or specific questions are ever shared.</p>
        {state.error ? <p className="err" role="alert" style={{ margin: "6px 0 0" }}>{state.error}</p> : null}
      </form>
      {state.hits && state.checkin ? <CheckIn people={state.people} buddy={mine.buddy} coach={mine.coach} setBuddy={setBuddy} setCoach={setCoach} /> : null}
      {showResults ? (
        state.hits!.length === 0 ? (
          <section className="card-s">
            <p style={{ margin: 0 }}>We do not have a perfect match for that yet. Try a few different words, or ask in the chats. People are glad to help.</p>
            <p style={{ margin: "10px 0 0" }}><Link className="btn small" href="/chats">Go to the chats</Link></p>
          </section>
        ) : (
          <>
            {bothNo ? <h2 className="qh" style={{ margin: "8px 0 0" }}>These may help you as well</h2> : null}
            <Results hits={state.hits!} />
          </>
        )
      ) : null}
    </div>
  );
}
