"use client";

import { PersonLink } from "@/components/people/ProfilePopup";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { openDockChat } from "@/components/messages/MessageDock";
import { facebookUrl, instagramUrl } from "@/lib/landing/types";
import { squareJpeg } from "@/lib/image/square";
import { lastSeen } from "@/lib/presence";
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

type Listing = { headline: string | null; about: string | null; tasks: string[]; hourly_rate_cents: number };
type Closer = { calls_taken: string | null; closer_since: string | null; close_rate: number | null; price_per_call_cents: number | null; price_per_sale: string | null };
export type View = "profile" | "services" | "closer" | "reviews";
type Stats = { calls_counted: number; members_booked: number; review_count: number; avg_rating: number | null; viewer_booked: boolean; my_rating: number | null; my_review: string | null; members_counted: number; members_base: string | null };

/** "40+" plus 3 new calls becomes "43+"; a figure that is not a number is shown as typed with the new calls noted. */
function totalCalls(base: string | null, counted: number): string | null {
  const m = (base ?? "").match(/^\s*(\d[\d,]*)(.*)$/);
  if (m) return (Number(m[1].replace(/,/g, "")) + counted).toLocaleString("en-US") + m[2];
  if (base && base.trim()) return counted ? `${base} (+${counted})` : base;
  return counted ? String(counted) : null;
}

/**
 * A profile bubble laid out like a contact card: picture and name on top, a row of buttons (Message, services, call closer),
 * then the details underneath. Choosing services or call closer swaps the details for that information, inside the same popup.
 * A guest speaker only shows a picture, a name and "Guest Speaker".
 */
export function ProfileCard({ p, guest = false, canMessage, onBack, onClose, startView = "profile" }: { p: MemberPerson; guest?: boolean; canMessage: boolean; onBack?: () => void; onClose: () => void; startView?: View }) {
  const [view, setView] = useState<View>(startView);
  const [zoom, setZoom] = useState(false);
  const [copied, setCopied] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [closerOn, setCloserOn] = useState(p.call_closer);
  const [presence, setPresence] = useState<{ text: string; online: boolean } | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsTick, setStatsTick] = useState(0);

  /* the call closer numbers shown at the top of the call closer view */
  useEffect(() => {
    if (guest || !p.id || !closerOn || view !== "closer") return;
    let live = true;
    void createClient().rpc("closer_stats", { p_id: p.id }).then(({ data }) => { if (live) setStats(((data as Stats[] | null) ?? [])[0] ?? null); });
    return () => { live = false; };
  }, [guest, p.id, closerOn, view, statsTick]);

  /* "online" or "last seen ...", refreshed while the popup is open (affiliates only; others get nothing back) */
  useEffect(() => {
    if (guest || !p.id) return;
    let live = true;
    const supabase = createClient();
    const refresh = () => { void supabase.rpc("presence_of", { p_id: p.id }).then(({ data }) => { if (live) setPresence(typeof data === "string" ? lastSeen(data) : null); }); };
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => { live = false; window.clearInterval(timer); };
  }, [guest, p.id]);

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

  const hasDetails = !guest && (p.username || (p.birth_month && p.birth_day));
  const tiles = (canMessage && !guest && p.username ? 1 : 0) + (!guest && p.offers_services ? 1 : 0) + (!guest && closerOn ? 1 : 0) + (!guest && p.instagram ? 1 : 0) + (!guest && p.facebook ? 1 : 0);

  async function toggleCloser() {
    const next = !closerOn;
    const { error } = await createClient().from("profiles").update({ call_closer: next }).eq("id", p.id);
    if (!error) setCloserOn(next);
  }

  return (
    <div className="pc">
      <div className="pc-bar">
        <button type="button" className={"pc-round" + (view === "profile" && !onBack ? " pc-ghost" : "")} onClick={view === "reviews" ? () => setView("closer") : view !== "profile" ? () => setView("profile") : onBack} aria-label={view === "reviews" ? "Back to the call closer details" : view !== "profile" ? "Back to the profile" : "Back to the list"} tabIndex={view === "profile" && !onBack ? -1 : 0}>
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
        <p className="pc-sub">{guest ? "Guest Speaker" : [p.is_admin ? "Admin" : null, view === "services" ? "Offers services" : view === "closer" ? "Call closer" : view === "reviews" ? "Call closer reviews" : p.is_admin ? null : "FLC member"].filter(Boolean).join(" · ")}</p>
        {!guest && presence ? (presence.online ? <p translate="no" className="pc-presence"><span className="pc-online-pill"><i aria-hidden="true" />online</span></p> : <p translate="no" className="pc-presence">{presence.text}</p>) : null}
      </div>

      {view === "profile" ? (
        <>
          {tiles > 0 ? (
            <div className="pc-tiles">
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
              {!guest && p.instagram ? (
                <a className="pc-tile pc-social" href={instagramUrl(p.instagram)} target="_blank" rel="noopener noreferrer" aria-label={`Instagram: @${p.instagram}`}>
                  <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
                    <defs><radialGradient id="ig-grad" cx="30%" cy="107%" r="150%"><stop offset="0" stopColor="#FED576" /><stop offset=".26" stopColor="#F47133" /><stop offset=".61" stopColor="#BC3081" /><stop offset="1" stopColor="#4C63D2" /></radialGradient></defs>
                    <rect x="1" y="1" width="22" height="22" rx="6.5" fill="url(#ig-grad)" />
                    <rect x="5.4" y="5.4" width="13.2" height="13.2" rx="4" fill="none" stroke="#fff" strokeWidth="1.8" />
                    <circle cx="12" cy="12" r="3.1" fill="none" stroke="#fff" strokeWidth="1.8" />
                    <circle cx="16.4" cy="7.6" r="1" fill="#fff" />
                  </svg>
                  <span>Instagram</span>
                </a>
              ) : null}
              {!guest && p.facebook ? (
                <a className="pc-tile pc-social" href={facebookUrl(p.facebook)} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                  <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="11" fill="#1877F2" />
                    <path fill="#fff" d="M13.4 22v-7.6h2.5l.4-3h-2.9V9.5c0-.9.3-1.5 1.5-1.5h1.5V5.3c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.5V22z" />
                  </svg>
                  <span>Facebook</span>
                </a>
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
              {p.birth_month && p.birth_day ? (
                <div className="pc-row">
                  <div><small>birthday</small><span>{`${MONTHS[p.birth_month - 1]} ${p.birth_day}${p.birth_year ? `, ${p.birth_year} (${ageOf(p.birth_year, p.birth_month, p.birth_day)} years old)` : ""}`}</span></div>
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
      {view === "closer" ? (
        <>
          <div className="pc-stats">
            <div className="pc-stat">
              <strong>{stats ? (totalCalls(stats.members_base, stats.members_counted) ?? "0") : "…"}</strong>
              <span>FLC {stats && totalCalls(stats.members_base, stats.members_counted) === "1" ? "member has" : "members have"} booked {p.first_name ?? "this closer"}</span>
            </div>
            <button type="button" className="pc-stat pc-stat-btn" onClick={() => setView("reviews")}>
              <strong><span className="pc-stars" aria-hidden="true">{stats?.avg_rating ? "★" : "☆"}</span> {stats?.avg_rating ?? "–"}</strong>
              <span>Reviews{stats ? ` (${stats.review_count})` : ""}</span>
            </button>
          </div>
          <CloserView id={p.id} admin={admin} stats={stats} onSaved={() => setStatsTick((n) => n + 1)} />
        </>
      ) : null}
      {view === "reviews" ? <ReviewsView id={p.id} admin={admin} /> : null}
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

function CloserView({ id, admin, stats, onSaved }: { id: string; admin: boolean; stats: Stats | null; onSaved: () => void }) {
  const [d, setD] = useState<Closer | null | undefined>(undefined);
  const [edit, setEdit] = useState(false);
  const [vals, setVals] = useState({ calls: "", members: "", since: "", rate: "", perCall: "", perSale: "" });
  const [msg, setMsg] = useState("");

  const load = useCallback(() => createClient().from("call_closer_details").select("calls_taken, closer_since, close_rate, price_per_call_cents, price_per_sale").eq("member_id", id).maybeSingle()
    .then(({ data }) => setD((data as Closer | null) ?? null)), [id]);
  useEffect(() => { void load(); }, [load]);
  const shownCalls = totalCalls(d?.calls_taken ?? null, stats?.calls_counted ?? 0);
  const shownMembers = stats ? totalCalls(stats.members_base, stats.members_counted) : null;

  function startEdit() {
    setVals({ calls: shownCalls ?? "", members: shownMembers ?? "", since: d?.closer_since ? sinceText(d.closer_since) : "", rate: d?.close_rate === null || d?.close_rate === undefined ? "" : String(d.close_rate),
      perCall: d?.price_per_call_cents == null ? "" : String(d.price_per_call_cents / 100), perSale: d?.price_per_sale ?? "" });
    setMsg(""); setEdit(true);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const num = (v: string) => { const n = Number(v.replace(/[$,%\s]/g, "")); return v.trim() === "" || Number.isNaN(n) ? null : n; };
    const bad = [vals.rate, vals.perCall].some((v) => v.trim() !== "" && num(v) === null);
    const since = vals.since.trim() ? parseSince(vals.since) : null;
    if (bad || (vals.since.trim() && !since)) { setMsg(!bad ? "Type the start as a month and year, like January 2024." : "Please type numbers only in the number boxes."); return; }
    const money2 = (v: string) => { const n = num(v); return n === null ? null : Math.round(n * 100); };
    const rate = num(vals.rate);
    /* if the calls figure was changed by hand, it becomes the new starting point and the automatic count starts again from now */
    const callsChanged = vals.calls.trim() !== (shownCalls ?? "");
    const membersChanged = vals.members.trim() !== (shownMembers ?? "");
    const row = { member_id: id, ...(callsChanged ? { calls_taken: vals.calls.trim().slice(0, 40) || null, counted_from: new Date().toISOString() } : {}), ...(membersChanged ? { members_booked: vals.members.trim().slice(0, 40) || null, members_counted_from: new Date().toISOString() } : {}), closer_since: since, close_rate: rate === null ? null : Math.min(100, Math.max(0, rate)),
      price_per_call_cents: money2(vals.perCall), price_per_sale: vals.perSale.trim().slice(0, 400) || null, updated_at: new Date().toISOString() };
    const { error } = await createClient().from("call_closer_details").upsert(row, { onConflict: "member_id" });
    if (error) { setMsg("We could not save that. Check the numbers and try again."); return; }
    setEdit(false); await load(); onSaved();
  }

  if (d === undefined) return <p className="pc-empty">Loading…</p>;
  if (edit) {
    return (
      <form className="pc-card pc-pad pc-form" onSubmit={(e) => void save(e)}>
        <label>Calls taken (counts up by itself after each call)<input type="text" autoComplete="off" maxLength={40} placeholder="e.g. 50+" value={vals.calls} onChange={(e) => setVals({ ...vals, calls: e.target.value })} /></label>
        <label>FLC members who have booked (counts up by itself after each new booking)<input type="text" autoComplete="off" maxLength={40} placeholder="e.g. 20+" value={vals.members} onChange={(e) => setVals({ ...vals, members: e.target.value })} /></label>
        <label>Taking calls since<input type="text" autoComplete="off" placeholder="e.g. January 2024" value={vals.since} onChange={(e) => setVals({ ...vals, since: e.target.value })} /></label>
        <label>Close rate (%)<input type="text" inputMode="decimal" autoComplete="off" placeholder="e.g. 85" value={vals.rate} onChange={(e) => setVals({ ...vals, rate: e.target.value })} /></label>
        <label>Charge per call (USD)<input type="text" inputMode="decimal" autoComplete="off" placeholder="e.g. 50" value={vals.perCall} onChange={(e) => setVals({ ...vals, perCall: e.target.value })} /></label>
        <label>Charge per product sale (USD) (press Enter for a new line)<textarea rows={4} maxLength={400} placeholder={"1A-3A = $50\n4A+ = 8% of total sales commission"} value={vals.perSale} onChange={(e) => setVals({ ...vals, perSale: e.target.value })} /></label>
        {msg ? <p className="err" role="alert">{msg}</p> : null}
        <div className="dlg-actions"><button type="button" className="btn small" onClick={() => setEdit(false)}>Cancel</button><button type="submit" className="btn small primary">Save</button></div>
      </form>
    );
  }
  const since = d?.closer_since ? lengthSince(d.closer_since) : null;
  return (
    <>
      <div className="pc-card">
        <div className="pc-row pc-plain"><div><small>calls taken</small><span>{shownCalls || "Not set yet"}</span></div></div>
        <div className="pc-row pc-plain"><div><small>taking calls for</small><span>{since ?? "Not set yet"}</span></div></div>
        <div className="pc-row pc-plain"><div><small>close rate</small><span>{d?.close_rate != null ? `${d.close_rate}%` : "Not set yet"}</span></div></div>
        <div className="pc-row pc-plain"><div><small>charges per call (USD)</small><span>{money(d?.price_per_call_cents ?? null)}</span></div></div>
        <div className="pc-row pc-plain"><div><small>charges per product sale (USD)</small><span className="pc-multiline">{d?.price_per_sale || "Not set"}</span></div></div>
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

type Review = { id: string; reviewer_id: string | null; reviewer_name: string | null; reviewer_photo_url: string | null; rating: number; review: string | null; created_at: string };
const OTHER = "__other__";
type Reviewer = { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null };

function ReviewsView({ id, admin }: { id: string; admin: boolean }) {
  const [list, setList] = useState<Review[] | null>(null);
  const [people, setPeople] = useState<Record<string, Reviewer>>({});
  const [stats, setStats] = useState<Stats | null>(null);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  /* admin only: add a review from an FLC member who worked with them before the portal had bookings */
  const [members, setMembers] = useState<{ id: string; first_name: string | null; last_name: string | null }[]>([]);
  const [past, setPast] = useState({ who: "", name: "", photo: "", rating: 0, text: "", when: "" });
  const [photoBusy, setPhotoBusy] = useState(false);
  const [pastMsg, setPastMsg] = useState("");

  useEffect(() => {
    if (!admin) return;
    let live = true;
    void createClient().rpc("member_directory", { p_kind: "affiliates" }).then(({ data }) => { if (live) setMembers(((data ?? []) as { id: string; first_name: string | null; last_name: string | null }[]).filter((m) => m.id !== id)); });
    return () => { live = false; };
  }, [admin, id]);

  const load = useCallback(async () => {
    const s = createClient();
    const [{ data: rows }, { data: st }] = await Promise.all([
      s.from("closer_reviews").select("id, reviewer_id, reviewer_name, reviewer_photo_url, rating, review, created_at").eq("closer_id", id).order("created_at", { ascending: false }).limit(50),
      s.rpc("closer_stats", { p_id: id }),
    ]);
    const reviews = (rows ?? []) as Review[];
    const ids = [...new Set(reviews.flatMap((r) => (r.reviewer_id ? [r.reviewer_id] : [])))];
    const { data: cards } = ids.length ? await s.from("profile_cards").select("id, first_name, last_name, avatar_url").in("id", ids) : { data: [] };
    setPeople(Object.fromEntries(((cards ?? []) as Reviewer[]).map((c) => [c.id, c])));
    const mine = ((st as Stats[] | null) ?? [])[0] ?? null;
    setStats(mine);
    setRating((cur) => cur || mine?.my_rating || 0);
    setText((cur) => cur || mine?.my_review || "");
    setList(reviews);
  }, [id]);
  useEffect(() => { const t = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(t); }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) { setMsg("Choose a star rating first."); return; }
    setBusy(true); setMsg("");
    const s = createClient();
    const { data: u } = await s.auth.getUser();
    const { error } = await s.from("closer_reviews").upsert({ closer_id: id, reviewer_id: u.user?.id, rating, review: text.trim().slice(0, 1000) || null, updated_at: new Date().toISOString() }, { onConflict: "closer_id,reviewer_id" });
    setBusy(false);
    if (error) { setMsg("We could not save your review. Please try again."); return; }
    await load();
  }
  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { setPastMsg("That file is not a picture. Try a JPG or PNG."); return; }
    setPhotoBusy(true); setPastMsg("");
    try {
      const path = `reviewers/${crypto.randomUUID()}.jpg`;
      const s = createClient();
      const { error } = await s.storage.from("speakers").upload(path, await squareJpeg(file), { contentType: "image/jpeg", cacheControl: "31536000" });
      if (error) throw error;
      setPast((cur) => ({ ...cur, photo: s.storage.from("speakers").getPublicUrl(path).data.publicUrl }));
    } catch { setPastMsg("We could not upload that picture. Please try another."); }
    setPhotoBusy(false);
  }

  async function addPast(e: React.FormEvent) {
    e.preventDefault();
    const typed = past.who === OTHER;
    if (!past.who) { setPastMsg("Choose the FLC member, or choose to type a name."); return; }
    if (typed && !past.name.trim()) { setPastMsg("Type their name."); return; }
    if (!past.rating) { setPastMsg("Choose a star rating."); return; }
    const when = past.when.trim() ? parseSince(past.when) : null;
    if (past.when.trim() && !when) { setPastMsg("Type the date as a month and year, like March 2024."); return; }
    setBusy(true); setPastMsg("");
    const { error } = await createClient().from("closer_reviews").insert({ closer_id: id, reviewer_id: typed ? null : past.who, ...(typed ? { reviewer_name: past.name.trim().slice(0, 80), reviewer_photo_url: past.photo || null } : {}), rating: past.rating, review: past.text.trim().slice(0, 1000) || null, imported: true, ...(when ? { created_at: `${when}T12:00:00Z` } : {}) });
    setBusy(false);
    if (error) { setPastMsg(error.code === "23505" ? "That member already has a review here. Remove theirs first to replace it." : "We could not add that review. Please try again."); return; }
    setPast({ who: "", name: "", photo: "", rating: 0, text: "", when: "" });
    await load();
  }
  async function removeReview(reviewId: string) {
    await createClient().from("closer_reviews").delete().eq("id", reviewId);
    await load();
  }
  async function removeMine() {
    const s = createClient();
    const { data: u } = await s.auth.getUser();
    await s.from("closer_reviews").delete().eq("closer_id", id).eq("reviewer_id", u.user?.id ?? "");
    setRating(0); setText(""); await load();
  }

  if (!list) return <p className="pc-empty">Loading…</p>;
  return (
    <>
      <div className="pc-card pc-pad">
        <p className="pc-headline">{stats?.avg_rating ? `★ ${stats.avg_rating} out of 5` : "No reviews yet"}{stats?.review_count ? <span className="pc-label"> · {stats.review_count} {stats.review_count === 1 ? "review" : "reviews"}</span> : null}</p>
        {list.length === 0 ? <p className="pc-label" style={{ margin: 0 }}>Reviews from FLC members who booked them will show here.</p> : (
          <ul className="pc-review-list">
            {list.map((r) => {
              const who = r.reviewer_id ? people[r.reviewer_id] : undefined;
              return (
                <li key={r.id}>
                  <div className="pc-review-top"><span className="pc-review-who"><PersonLink id={r.reviewer_id} name={who ? fullName(who) : r.reviewer_name ?? "FLC member"}><Avatar url={who?.avatar_url ?? r.reviewer_photo_url} initials={who ? initialsOf(who) : (r.reviewer_name ?? "?").trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("") || "?"} size={36} /><strong>{who ? fullName(who) : r.reviewer_name ?? "FLC member"}</strong></PersonLink></span><span className="pc-stars" aria-label={`${r.rating} out of 5`}>{"★".repeat(r.rating).padEnd(5, "☆")}</span></div>
                  {r.review ? <p className="pc-about">{r.review}</p> : null}
                  {admin ? <button type="button" className="linkbtn" style={{ padding: "2px 0", fontSize: 13, justifySelf: "start" }} onClick={() => void removeReview(r.id)}>Remove this review (admin)</button> : null}
                  <small className="pc-label">{new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</small>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {admin ? (
        <form className="pc-card pc-pad pc-form" onSubmit={(e) => void addPast(e)}>
          <strong>Add a past review (admin only)</strong>
          <label>FLC member who worked with them
            <select value={past.who} onChange={(e) => setPast({ ...past, who: e.target.value })}>
              <option value="">Choose an FLC member</option>
              <option value={OTHER}>Someone not in the portal (type their name)</option>
              {members.map((m) => <option key={m.id} value={m.id}>{fullName(m)}</option>)}
            </select>
          </label>
          {past.who === OTHER ? (
            <>
              <label>Their name<input type="text" autoComplete="off" maxLength={80} placeholder="e.g. Jamie Carter" value={past.name} onChange={(e) => setPast({ ...past, name: e.target.value })} /></label>
              <div className="pc-photo-pick">
                <Avatar url={past.photo || null} initials={past.name.trim() ? past.name.trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("") : "?"} size={56} />
                <label className="btn small pc-photo-btn">{photoBusy ? "Uploading…" : past.photo ? "Change picture" : "Add a picture (optional)"}<input type="file" accept="image/*" hidden disabled={photoBusy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void uploadPhoto(f); }} /></label>
              </div>
            </>
          ) : null}
          <div className="pc-star-pick" role="radiogroup" aria-label="Their rating">
            {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={past.rating === n} aria-label={`${n} out of 5`} className={n <= past.rating ? "on" : ""} onClick={() => setPast({ ...past, rating: n })}>★</button>)}
          </div>
          <label>What they said (optional)<textarea rows={3} maxLength={1000} value={past.text} onChange={(e) => setPast({ ...past, text: e.target.value })} /></label>
          <label>When (optional, month and year)<input type="text" autoComplete="off" placeholder="e.g. March 2024" value={past.when} onChange={(e) => setPast({ ...past, when: e.target.value })} /></label>
          {pastMsg ? <p className="err" role="alert">{pastMsg}</p> : null}
          <div className="dlg-actions"><button type="submit" className="btn small primary" disabled={busy}>{busy ? "Adding…" : "Add review"}</button></div>
        </form>
      ) : null}
      {stats?.viewer_booked ? (
        <form className="pc-card pc-pad pc-form" onSubmit={(e) => void save(e)}>
          <strong>{stats.my_rating ? "Your review" : "Leave a review"}</strong>
          <div className="pc-star-pick" role="radiogroup" aria-label="Your rating">
            {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} out of 5`} className={n <= rating ? "on" : ""} onClick={() => setRating(n)}>★</button>)}
          </div>
          <textarea rows={3} maxLength={1000} placeholder="How was your call? (optional)" value={text} onChange={(e) => setText(e.target.value)} />
          {msg ? <p className="err" role="alert">{msg}</p> : null}
          <div className="dlg-actions">
            {stats.my_rating ? <button type="button" className="linkbtn" onClick={() => void removeMine()}>Remove my review</button> : null}
            <button type="submit" className="btn small primary" disabled={busy}>{busy ? "Saving…" : "Save review"}</button>
          </div>
        </form>
      ) : <p className="pc-empty">Only FLC members who booked a call with them can leave a review.</p>}
    </>
  );
}
