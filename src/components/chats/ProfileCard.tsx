"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { openDockChat } from "@/components/messages/MessageDock";
import { facebookUrl, instagramUrl } from "@/lib/landing/types";
import { createClient } from "@/lib/supabase/client";

export type MemberPerson = { id: string; first_name: string | null; last_name: string | null; username: string | null; avatar_url: string | null; instagram: string | null; facebook: string | null; is_admin: boolean; birth_month: number | null; birth_day: number | null; birth_year: number | null; call_closer: boolean; offers_services: boolean };
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const fullName = (p: Pick<MemberPerson, "first_name" | "last_name">) => [p.first_name, p.last_name].filter(Boolean).join(" ") || "Member";
export const initialsOf = (p: Pick<MemberPerson, "first_name" | "last_name">) => ((p.first_name ?? "").charAt(0) + (p.last_name ?? "").charAt(0)).toUpperCase() || "?";

const money = (cents: number | null) => (cents === null ? "Not set" : `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`);
const svg = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

function ageOf(y: number, m: number, d: number): number {
  const now = new Date();
  let a = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) a -= 1;
  return a;
}
function handleOf(v: string): string { return v.startsWith("https://") ? "View page" : "@" + v; }

type Listing = { headline: string | null; about: string | null; tasks: string[]; hourly_rate_cents: number };
type Closer = { calls_taken: number; closer_since: string | null; close_rate: number | null; price_per_call_cents: number | null; price_per_sale_cents: number | null };
type View = "profile" | "services" | "closer";

/**
 * A profile bubble laid out like a contact card: picture and name on top, a row of buttons (Message, services, call closer),
 * then the details underneath. Choosing services or call closer swaps the details for that information, inside the same popup.
 * A guest speaker only shows a picture, a name and "Guest Speaker".
 */
export function ProfileCard({ p, guest = false, canMessage, onBack, onClose }: { p: MemberPerson; guest?: boolean; canMessage: boolean; onBack?: () => void; onClose: () => void }) {
  const [view, setView] = useState<View>("profile");
  const [zoom, setZoom] = useState(false);
  const [copied, setCopied] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [closerOn, setCloserOn] = useState(p.call_closer);

  /* admins get a switch for "call closer" and can fill in a closer's numbers */
  useEffect(() => {
    if (guest) return;
    const s = createClient();
    void s.auth.getUser().then(({ data }) => {
      const id = data.user?.id;
      if (!id) return;
      void s.from("profiles").select("role").eq("id", id).maybeSingle().then(({ data: r }) => setAdmin((r as { role: string } | null)?.role === "admin"));
    });
  }, [guest]);

  if (zoom && p.avatar_url) {
    return (
      <button type="button" className="member-zoom" onClick={() => setZoom(false)} aria-label="Close the large picture">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.avatar_url} alt={fullName(p)} />
      </button>
    );
  }

  const hasDetails = !guest && (p.username || p.instagram || p.facebook || (p.birth_month && p.birth_day));
  const tiles = (canMessage && !guest && p.username ? 1 : 0) + (!guest && p.offers_services ? 1 : 0) + (!guest && closerOn ? 1 : 0);

  async function toggleCloser() {
    const next = !closerOn;
    const { error } = await createClient().from("profiles").update({ call_closer: next }).eq("id", p.id);
    if (!error) setCloserOn(next);
  }

  return (
    <div className="pc">
      <div className="pc-bar">
        <button type="button" className={"pc-round" + (view === "profile" && !onBack ? " pc-ghost" : "")} onClick={view !== "profile" ? () => setView("profile") : onBack} aria-label={view !== "profile" ? "Back to the profile" : "Back to the list"} tabIndex={view === "profile" && !onBack ? -1 : 0}>
          <svg width="20" height="20" viewBox="0 0 24 24" {...svg}><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <button type="button" className="pc-round" onClick={onClose} aria-label="Close"><svg width="20" height="20" viewBox="0 0 24 24" {...svg}><path d="m6 6 12 12M18 6 6 18" /></svg></button>
      </div>

      <div className="pc-top">
        {p.avatar_url ? (
          <button type="button" className="member-photo" onClick={() => setZoom(true)} aria-label={`Enlarge ${fullName(p)}'s picture`} title="Click to enlarge">
            <Avatar url={p.avatar_url} initials={initialsOf(p)} size={120} />
          </button>
        ) : <Avatar url={null} initials={initialsOf(p)} size={120} />}
        <h2 className="pc-name">{fullName(p)}</h2>
        <p className="pc-sub">{guest ? "Guest Speaker" : view === "services" ? "Offers services" : view === "closer" ? "Call closer" : p.is_admin ? "Admin" : "FLC member"}</p>
      </div>

      {view === "profile" ? (
        <>
          {tiles > 0 ? (
            <div className="pc-tiles" style={{ gridTemplateColumns: `repeat(${tiles}, minmax(0, 1fr))` }}>
              {canMessage && !guest && p.username ? (
                <button type="button" className="pc-tile" onClick={() => { openDockChat(p.id); onClose(); }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.4 1.3 4.5 3.4 6L4.8 21l4-1.8c.9.2 2 .3 3.2.3 5.5 0 10-3.6 10-8S17.5 3 12 3z" /></svg>
                  <span>Message</span>
                </button>
              ) : null}
              {!guest && p.offers_services ? (
                <button type="button" className="pc-tile" onClick={() => setView("services")}>
                  <svg width="26" height="26" viewBox="0 0 24 24" {...svg}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" /></svg>
                  <span>Outsourcing</span>
                </button>
              ) : null}
              {!guest && closerOn ? (
                <button type="button" className="pc-tile" onClick={() => setView("closer")}>
                  <svg width="26" height="26" viewBox="0 0 24 24" {...svg}><path d="M5 4h14l-2 7H7zM12 11v6M8 21h8" /><circle cx="12" cy="8" r="0.8" fill="currentColor" /></svg>
                  <span>Call closer</span>
                </button>
              ) : null}
            </div>
          ) : null}

          {hasDetails ? (
            <div className="pc-card">
              {p.username ? (
                <div className="pc-row">
                  <div><small>username</small><span className="pc-link">@{p.username}</span></div>
                  <button type="button" className="pc-icon" aria-label="Copy username" title="Copy username"
                    onClick={() => { void navigator.clipboard?.writeText("@" + p.username).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); }); }}>
                    {copied ? <span className="pc-copied">Copied</span> : <svg width="22" height="22" viewBox="0 0 24 24" {...svg}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></svg>}
                  </button>
                </div>
              ) : null}
              {p.instagram ? (
                <a className="pc-row" href={instagramUrl(p.instagram)} target="_blank" rel="noopener noreferrer">
                  <div><small>instagram</small><span className="pc-link">{handleOf(p.instagram)}</span></div>
                  <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
                    <defs><radialGradient id="ig-grad" cx="30%" cy="107%" r="150%"><stop offset="0" stopColor="#FED576" /><stop offset=".26" stopColor="#F47133" /><stop offset=".61" stopColor="#BC3081" /><stop offset="1" stopColor="#4C63D2" /></radialGradient></defs>
                    <rect x="1" y="1" width="22" height="22" rx="6.5" fill="url(#ig-grad)" />
                    <rect x="5.4" y="5.4" width="13.2" height="13.2" rx="4" fill="none" stroke="#fff" strokeWidth="1.8" />
                    <circle cx="12" cy="12" r="3.1" fill="none" stroke="#fff" strokeWidth="1.8" />
                    <circle cx="16.4" cy="7.6" r="1" fill="#fff" />
                  </svg>
                </a>
              ) : null}
              {p.facebook ? (
                <a className="pc-row" href={facebookUrl(p.facebook)} target="_blank" rel="noopener noreferrer">
                  <div><small>facebook</small><span className="pc-link">{handleOf(p.facebook)}</span></div>
                  <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="11" fill="#1877F2" />
                    <path fill="#fff" d="M13.4 22v-7.6h2.5l.4-3h-2.9V9.5c0-.9.3-1.5 1.5-1.5h1.5V5.3c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.5V22z" />
                  </svg>
                </a>
              ) : null}
              {p.birth_month && p.birth_day ? (
                <div className="pc-row">
                  <div><small>birthday</small><span>{MONTHS[p.birth_month - 1]} {p.birth_day}{p.birth_year ? `, ${p.birth_year} (${ageOf(p.birth_year, p.birth_month, p.birth_day)} years old)` : ""}</span></div>
                </div>
              ) : null}
            </div>
          ) : null}

          {admin && !guest && p.id ? (
            <label className="pc-admin"><input type="checkbox" checked={closerOn} onChange={() => void toggleCloser()} /> Call closer <small>(admin only)</small></label>
          ) : null}
        </>
      ) : null}

      {view === "services" ? <ServicesView id={p.id} /> : null}
      {view === "closer" ? <CloserView id={p.id} admin={admin} /> : null}
    </div>
  );
}

function ServicesView({ id }: { id: string }) {
  const [l, setL] = useState<Listing | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void createClient().from("outsourcing_profiles").select("headline, about, tasks, hourly_rate_cents").eq("member_id", id).eq("listed", true).maybeSingle()
      .then(({ data }) => { if (live) setL((data as Listing | null) ?? null); });
    return () => { live = false; };
  }, [id]);
  if (l === undefined) return <p className="pc-empty">Loading…</p>;
  if (l === null) return <p className="pc-empty">They are not offering services right now.</p>;
  return (
    <div className="pc-card pc-pad">
      {l.headline ? <p className="pc-headline">{l.headline}</p> : null}
      <small className="pc-label">Tasks they offer</small>
      <ul className="pc-tasks">{l.tasks.map((t) => <li key={t}>{t}</li>)}</ul>
      <div className="pc-row pc-plain"><div><small>rate</small><span>{money(l.hourly_rate_cents)} per hour</span></div></div>
      {l.about ? <><small className="pc-label">About</small><p className="pc-about">{l.about}</p></> : null}
      <Link className="btn small" href="/outsourcing">See them in Outsourcing</Link>
    </div>
  );
}

function CloserView({ id, admin }: { id: string; admin: boolean }) {
  const [d, setD] = useState<Closer | null | undefined>(undefined);
  const [edit, setEdit] = useState(false);
  const [vals, setVals] = useState({ calls: "", since: "", rate: "", perCall: "", perSale: "" });
  const [msg, setMsg] = useState("");

  const load = useCallback(() => createClient().from("call_closer_details").select("calls_taken, closer_since, close_rate, price_per_call_cents, price_per_sale_cents").eq("member_id", id).maybeSingle()
    .then(({ data }) => setD((data as Closer | null) ?? null)), [id]);
  useEffect(() => { void load(); }, [load]);

  function startEdit() {
    setVals({ calls: String(d?.calls_taken ?? 0), since: d?.closer_since ? sinceText(d.closer_since) : "", rate: d?.close_rate === null || d?.close_rate === undefined ? "" : String(d.close_rate),
      perCall: d?.price_per_call_cents == null ? "" : String(d.price_per_call_cents / 100), perSale: d?.price_per_sale_cents == null ? "" : String(d.price_per_sale_cents / 100) });
    setMsg(""); setEdit(true);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const num = (v: string) => { const n = Number(v.replace(/[$,%\s]/g, "")); return v.trim() === "" || Number.isNaN(n) ? null : n; };
    const bad = [vals.calls, vals.rate, vals.perCall, vals.perSale].some((v) => v.trim() !== "" && num(v) === null);
    const since = vals.since.trim() ? parseSince(vals.since) : null;
    if (bad || (vals.since.trim() && !since)) { setMsg(!bad ? "Type the start as a month and year, like January 2024." : "Please type numbers only in the number boxes."); return; }
    const money2 = (v: string) => { const n = num(v); return n === null ? null : Math.round(n * 100); };
    const rate = num(vals.rate);
    const row = { member_id: id, calls_taken: Math.max(0, Math.floor(num(vals.calls) ?? 0)), closer_since: since, close_rate: rate === null ? null : Math.min(100, Math.max(0, rate)),
      price_per_call_cents: money2(vals.perCall), price_per_sale_cents: money2(vals.perSale), updated_at: new Date().toISOString() };
    const { error } = await createClient().from("call_closer_details").upsert(row, { onConflict: "member_id" });
    if (error) { setMsg("We could not save that. Check the numbers and try again."); return; }
    setEdit(false); await load();
  }

  if (d === undefined) return <p className="pc-empty">Loading…</p>;
  if (edit) {
    return (
      <form className="pc-card pc-pad pc-form" onSubmit={(e) => void save(e)}>
        <label>Calls taken<input type="text" inputMode="numeric" autoComplete="off" placeholder="e.g. 40" value={vals.calls} onChange={(e) => setVals({ ...vals, calls: e.target.value })} /></label>
        <label>Taking calls since<input type="text" autoComplete="off" placeholder="e.g. January 2024" value={vals.since} onChange={(e) => setVals({ ...vals, since: e.target.value })} /></label>
        <label>Close rate (%)<input type="text" inputMode="decimal" autoComplete="off" placeholder="e.g. 85" value={vals.rate} onChange={(e) => setVals({ ...vals, rate: e.target.value })} /></label>
        <label>Charge per call ($)<input type="text" inputMode="decimal" autoComplete="off" placeholder="e.g. 50" value={vals.perCall} onChange={(e) => setVals({ ...vals, perCall: e.target.value })} /></label>
        <label>Charge per product sale ($)<input type="text" inputMode="decimal" autoComplete="off" placeholder="e.g. 100" value={vals.perSale} onChange={(e) => setVals({ ...vals, perSale: e.target.value })} /></label>
        {msg ? <p className="err" role="alert">{msg}</p> : null}
        <div className="dlg-actions"><button type="button" className="btn small" onClick={() => setEdit(false)}>Cancel</button><button type="submit" className="btn small primary">Save</button></div>
      </form>
    );
  }
  const since = d?.closer_since ? lengthSince(d.closer_since) : null;
  return (
    <>
      <div className="pc-card">
        <div className="pc-row pc-plain"><div><small>calls taken</small><span>{d ? d.calls_taken.toLocaleString("en-US") : "Not set yet"}</span></div></div>
        <div className="pc-row pc-plain"><div><small>taking calls for</small><span>{since ?? "Not set yet"}</span></div></div>
        <div className="pc-row pc-plain"><div><small>close rate</small><span>{d?.close_rate != null ? `${d.close_rate}%` : "Not set yet"}</span></div></div>
        <div className="pc-row pc-plain"><div><small>charges per call</small><span>{money(d?.price_per_call_cents ?? null)}</span></div></div>
        <div className="pc-row pc-plain"><div><small>charges per product sale</small><span>{money(d?.price_per_sale_cents ?? null)}</span></div></div>
      </div>
      {admin ? <button type="button" className="btn small pc-edit" onClick={startEdit}>Edit these details</button> : null}
    </>
  );
}

/** "January 2024" for the text box. */
function sinceText(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}
/** Understands "January 2024", "Jan 2024", "1/2024", "01-2024" or a full date, and returns the first of that month as YYYY-MM-DD (or null). */
function parseSince(text: string): string | null {
  const t = text.trim();
  let y = 0, m = 0;
  const num = t.match(/^(\d{1,2})\s*[/.-]\s*(\d{4})$/);
  const word = t.match(/^([A-Za-z]{3,9})\.?,?\s+(\d{4})$/);
  const full = t.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
  if (num) { m = Number(num[1]); y = Number(num[2]); }
  else if (word) { m = MONTHS.findIndex((x) => x.toLowerCase().startsWith(word[1].toLowerCase().slice(0, 3))) + 1; y = Number(word[2]); }
  else if (full) { y = Number(full[1]); m = Number(full[2]); }
  if (!m || m > 12 || y < 1980 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

/** "2 years, 3 months" from a date to today. */
function lengthSince(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const now = new Date();
  let months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
  if (now.getDate() < d) months -= 1;
  if (months < 1) return "Less than a month";
  const yrs = Math.floor(months / 12), mo = months % 12;
  return [yrs ? `${yrs} ${yrs === 1 ? "year" : "years"}` : "", mo ? `${mo} ${mo === 1 ? "month" : "months"}` : ""].filter(Boolean).join(", ");
}
