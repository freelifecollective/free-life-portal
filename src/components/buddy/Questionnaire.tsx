"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { resetBuddyAnswers, saveBuddyAnswers } from "@/app/(app)/buddy/actions";
import { CITIES, MINLEN, PNA, QUESTIONS, ZONES, type Question } from "@/lib/buddy/questions";
import { firstIncomplete, isValid, type Answer, type Answers } from "@/lib/buddy/validate";

const N = QUESTIONS.length;
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function tzNote(tz: string): string {
  try {
    const d = new Date();
    const name = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "long" }).formatToParts(d).find((p) => p.type === "timeZoneName")?.value ?? tz;
    return `Timezone set: ${name}`;
  } catch { return ""; }
}
const show = (a: Answer | undefined) => (Array.isArray(a) ? a.join(", ") : a && typeof a === "object" ? a.city : String(a ?? ""));

function CityField({ value, onPick }: { value: Answer | undefined; onPick: (a: Answer | undefined) => void }) {
  const [text, setText] = useState(value && typeof value === "object" && !Array.isArray(value) ? value.city : "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [zones, setZones] = useState(false);
  const hits = useMemo(() => {
    const s = norm(text.trim());
    if (!s) return [];
    const a: typeof CITIES = [], b: typeof CITIES = [];
    for (const c of CITIES) { const n = norm(c[0]), k = norm(c[1]); if (n.startsWith(s)) a.push(c); else if (n.includes(s) || k.startsWith(s) || norm(`${c[0]}, ${c[1]}`).includes(s)) b.push(c); }
    return [...a, ...b].slice(0, 8);
  }, [text]);
  const pick = (c: (typeof CITIES)[number]) => { setText(`${c[0]}, ${c[1]}`); setOpen(false); onPick({ city: `${c[0]}, ${c[1]}`, tz: c[2] }); };
  const current = value && typeof value === "object" && !Array.isArray(value) ? value : null;
  return (
    <div>
      <div className="bq-combo">
        <label className="sr-only" htmlFor="bq-city">Your city</label>
        <input id="bq-city" type="text" autoComplete="off" spellCheck={false} placeholder="Start typing your city" role="combobox" aria-autocomplete="list" aria-expanded={open && hits.length > 0} aria-controls="bq-lb"
          value={text}
          onChange={(e) => { setText(e.target.value); setOpen(true); setActive(0); onPick(undefined); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && hits.length) { e.preventDefault(); setActive((active + 1) % hits.length); }
            else if (e.key === "ArrowUp" && hits.length) { e.preventDefault(); setActive((active - 1 + hits.length) % hits.length); }
            else if (e.key === "Escape" && open) { e.preventDefault(); setOpen(false); }
            else if (e.key === "Enter" && open && hits[active]) { e.preventDefault(); e.stopPropagation(); pick(hits[active]); }
          }}
          onBlur={() => setTimeout(() => setOpen(false), 120)} />
        {open && hits.length ? (
          <ul id="bq-lb" role="listbox" className="bq-lb">
            {hits.map((c, i) => <li key={`${c[0]}${c[1]}`} role="option" aria-selected={i === active} onMouseDown={(e) => { e.preventDefault(); pick(c); }}><strong>{c[0]}</strong>, {c[1]}</li>)}
          </ul>
        ) : null}
      </div>
      <p className="bq-count" aria-live="polite">{current ? tzNote(current.tz) : ""}</p>
      <button type="button" className="linkbtn" style={{ padding: 0 }} onClick={() => setZones(!zones)}>I can&apos;t find my city</button>
      {zones ? (
        <div className="field" style={{ maxWidth: 640, marginTop: 8 }}>
          <label className="sr-only" htmlFor="bq-zone">Choose your timezone</label>
          <select id="bq-zone" defaultValue="" onChange={(e) => { if (e.target.value === "") return; const z = ZONES[Number(e.target.value)]; setText(""); onPick({ city: z[0], tz: z[1] }); }}>
            <option value="">Choose your timezone</option>
            {ZONES.map((z, k) => <option key={z[1]} value={k}>{z[0]}</option>)}
          </select>
        </div>
      ) : null}
    </div>
  );
}

function Field({ q, value, onChange }: { q: Question; value: Answer | undefined; onChange: (a: Answer | undefined) => void }) {
  if (q.t === "city") return <CityField value={value} onPick={onChange} />;
  if (q.t === "single" || q.t === "multi") {
    const cur = q.t === "multi" ? (Array.isArray(value) ? value : []) : [];
    return (
      <div className={"bq-opts" + (q.tags ? " tags" : "")} role={q.t === "single" ? "radiogroup" : "group"} aria-label={q.q}>
        {(q.o ?? []).map((label) => {
          const on = q.t === "single" ? value === label : cur.includes(label);
          const locked = q.t === "multi" && !on && ((q.excl && cur.some((x) => q.excl!.includes(x))) || (q.max !== undefined && q.max < 99 && cur.length >= q.max));
          return (
            <button key={label} type="button" className={"bq-opt" + (q.t === "multi" ? " multi" : "")} role={q.t === "single" ? "radio" : "checkbox"} aria-checked={on} aria-disabled={!!locked}
              onClick={() => {
                if (locked) return;
                if (q.t === "single") return onChange(label);
                const next = cur.includes(label) ? cur.filter((x) => x !== label) : q.excl?.includes(label) ? [label] : [...cur, label];
                onChange(next.length ? next : undefined);
              }}>
              <span className="mk" aria-hidden="true" /><span>{label}</span>
            </button>
          );
        })}
      </div>
    );
  }
  if (q.t === "select") {
    return (
      <div className="field" style={{ maxWidth: 240 }}>
        <label className="sr-only" htmlFor="bq-sel">Select one</label>
        <select id="bq-sel" value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">{q.ph}</option>
          {(q.o ?? []).map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>
    );
  }
  if (q.t === "text") {
    const text = typeof value === "string" ? value : "";
    return (
      <div className="field">
        <label className="sr-only" htmlFor="bq-text">{q.q}</label>
        <textarea id="bq-text" rows={4} maxLength={600} placeholder={q.ph} value={text} onChange={(e) => onChange(e.target.value)} />
        <p className="bq-count" aria-live="polite">{text.trim().length < MINLEN ? `A few more words, please (at least ${MINLEN} characters)` : "Looks good"}</p>
      </div>
    );
  }
  const pna = value === PNA;
  return (
    <div>
      <div className="field" style={{ maxWidth: 200 }}>
        <label className="sr-only" htmlFor="bq-num">Age</label>
        <input id="bq-num" type="number" inputMode="numeric" min={q.min} max={q.max} placeholder={q.ph} disabled={pna} value={typeof value === "number" ? value : ""}
          onChange={(e) => { const v = e.target.value === "" ? NaN : Math.floor(Number(e.target.value)); onChange(Number.isNaN(v) ? undefined : v); }} />
      </div>
      <button type="button" className="linkbtn" aria-pressed={pna} style={{ padding: "8px 0", fontWeight: pna ? 700 : undefined }} onClick={() => onChange(pna ? undefined : PNA)}>{PNA}</button>
    </div>
  );
}

/** The 26-question questionnaire: one question per screen, saved as you go, with a review screen at the end. */
export function Questionnaire({ initial, onFinished }: { initial: Answers; onFinished: () => void }) {
  const first = firstIncomplete(initial);
  const [ans, setAns] = useState<Answers>(initial);
  const [view, setView] = useState<"q" | "review">(first === -1 ? "review" : "q");
  const [idx, setIdx] = useState(first === -1 ? N - 1 : first);
  const [fromReview, setFromReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [epoch, setEpoch] = useState(0);
  const head = useRef<HTMLHeadingElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const q = QUESTIONS[idx];
  const done = QUESTIONS.filter((x) => isValid(x, ans[x.k])).length;
  const allDone = done === N;

  useEffect(() => { head.current?.focus({ preventScroll: true }); window.scrollTo(0, 0); }, [idx, view]);

  function change(k: string, v: Answer | undefined) {
    setAns((cur) => {
      const next = { ...cur };
      if (v === undefined) delete next[k]; else next[k] = v;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => { void saveBuddyAnswers(next); }, 600);
      return next;
    });
  }

  async function finish() {
    setBusy(true); setError("");
    window.clearTimeout(timer.current);
    const r = await saveBuddyAnswers(ans);
    setBusy(false);
    if (!r.ok || !r.complete) return setError(r.error ?? "Some answers are missing. Please check them and try again.");
    onFinished();
  }

  async function startOver() {
    if (!window.confirm("Start over from the beginning? All of your answers will be cleared.")) return;
    window.clearTimeout(timer.current);
    setBusy(true); setError("");
    const r = await resetBuddyAnswers();
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "That did not work.");
    setAns({}); setEpoch((n) => n + 1); setFromReview(false); setView("q"); setIdx(0);
  }

  const goBack = () => {
    if (view === "review") { setIdx(N - 1); setView("q"); }
    else if (fromReview) { setFromReview(false); setView("review"); }
    else if (idx > 0) setIdx(idx - 1);
  };
  const next = () => {
    if (fromReview) { setFromReview(false); setView("review"); }
    else if (idx === N - 1) setView("review");
    else setIdx(idx + 1);
  };
  const pct = view === "review" ? 100 : (idx / N) * 100;

  return (
    <div className="bq">
      <div className="bq-prog">
        <div className="bq-prog-top"><span>{view === "q" ? q.sec : "Review"}</span><span>{view === "q" ? `Question ${idx + 1} of ${N}` : `${done} of ${N} answered`}</span></div>
        <div className="bq-bar" role="progressbar" aria-valuemin={0} aria-valuemax={N} aria-valuenow={view === "q" ? idx : N}><i style={{ width: `${pct}%` }} /></div>
      </div>

      {view === "q" ? (
        <section>
          <h1 ref={head} tabIndex={-1} className="bq-h">{q.q}</h1>
          {q.h ? <p className="bq-help">{q.h}</p> : null}
          <Field key={`${q.k}-${epoch}`} q={q} value={ans[q.k]} onChange={(v) => change(q.k, v)} />
          <div className="bq-actions">
            {idx > 0 || fromReview ? <button type="button" className="backbtn" aria-label="Go back" onClick={goBack}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg></button> : null}
            <button type="button" className="btn primary" disabled={!isValid(q, ans[q.k])} onClick={next}>{fromReview ? "Save answer" : idx === N - 1 ? "Review my answers" : "Continue"}</button>
            {!fromReview && idx < N - 1 && allDone ? <button type="button" className="btn" onClick={() => setIdx(N - 1)}>Jump to last question</button> : null}
          </div>
          {allDone && !fromReview ? (
            <div className="bq-actions" style={{ marginTop: 12 }}>
              {idx > 0 ? <button type="button" className="btn" onClick={() => setIdx(0)}>Jump to the First Question</button> : null}
              <button type="button" className="linkbtn" disabled={busy} onClick={startOver}>Start Over From the Beginning</button>
            </div>
          ) : null}
        </section>
      ) : (
        <section>
          <h1 ref={head} tabIndex={-1} className="bq-h">Review your answers</h1>
          <p className="bq-help">Check everything looks right. You can change any answer.</p>
          <ul className="bq-review">
            {QUESTIONS.map((x, i) => (
              <li key={x.k}>
                <div><strong>{x.q}</strong><span>{ans[x.k] === undefined ? "Not answered" : show(ans[x.k])}</span></div>
                <button type="button" className="linkbtn" onClick={() => { setIdx(i); setFromReview(true); setView("q"); }}>Change</button>
              </li>
            ))}
          </ul>
          <p className="err" role="alert">{error}</p>
          <div className="bq-actions">
            <button type="button" className="backbtn" aria-label="Go back" onClick={goBack}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg></button>
            <button type="button" className="btn primary bq-find" disabled={!allDone || busy} onClick={finish}>{busy ? "Finding…" : "FIND MY TOP 5 MATCHES"}</button>
          </div>
          <div className="bq-actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn" onClick={() => { setFromReview(false); setIdx(0); setView("q"); }}>Jump to the First Question</button>
            <button type="button" className="linkbtn" disabled={busy} onClick={startOver}>Start Over From the Beginning</button>
          </div>
        </section>
      )}
    </div>
  );
}
