/* eslint-disable @next/next/no-img-element */
import { Avatar } from "@/components/Avatar";
import { ReviewControls } from "@/components/closers/ReviewControls";
import { PersonLink } from "@/components/people/ProfilePopup";
import { PageHeading } from "@/components/PageHeading";
import { requireAdmin } from "@/lib/auth/guards";
import { authorsById } from "@/lib/chats/queries";
import { dollars, type Application } from "@/lib/closers/types";
import { formatInZone } from "@/lib/time";

export const instant = false;
export const metadata = { title: "Call closer applications" };

export default async function CloserApplicationsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("closer_applications")
    .select("id, member_id, status, experience, calls_taken, cover_url, location, experience_text, bio, availability, pitch, price_per_call_cents, price_per_sale, review_note, created_at")
    .order("created_at", { ascending: false }).limit(100);
  const apps = (data ?? []) as Application[];
  const people = await authorsById(supabase, [...new Set(apps.map((a) => a.member_id))]);
  const pending = apps.filter((a) => a.status === "pending");
  const done = apps.filter((a) => a.status !== "pending");
  const row = (a: Application, decided: boolean) => {
    const who = people.get(a.member_id);
    const name = who?.name ?? "A member";
    return (
      <li key={a.id} className="card-s" style={{ display: "grid", gap: 8 }}>
        <PersonLink id={a.member_id} name={name} className="who"><Avatar url={who?.avatar_url ?? null} initials={name.charAt(0).toUpperCase()} size={44} /><span className="who-name"><strong>{name}</strong><span className="when">{formatInZone(new Date(a.created_at))}</span></span></PersonLink>
        {a.cover_url ? <img src={a.cover_url} alt="" style={{ width: 120, aspectRatio: "4 / 5", objectFit: "cover", borderRadius: 12 }} /> : null}
        <p style={{ margin: 0 }}><b>Where:</b> {a.location}</p>
        <p style={{ margin: 0 }}><b>Experience:</b> {a.experience_text}{a.calls_taken ? ` · ${a.calls_taken} calls` : ""}</p>
        <p style={{ margin: 0, whiteSpace: "pre-line" }}><b>Bio:</b> {a.bio}</p>
        <p style={{ margin: 0 }}><b>Available:</b> {a.availability}</p>
        <p style={{ margin: 0, whiteSpace: "pre-line" }}><b>Why:</b> {a.pitch}</p>
        {a.price_per_call_cents !== null || a.price_per_sale ? <p style={{ margin: 0 }}><b>Price:</b> {a.price_per_call_cents !== null ? `${dollars(a.price_per_call_cents)} per call` : ""}{a.price_per_call_cents !== null && a.price_per_sale ? " · " : ""}{a.price_per_sale ?? ""}</p> : null}
        {decided ? <p className="when" style={{ margin: 0 }}>{a.status === "approved" ? "Approved" : "Declined"}{a.review_note ? `: ${a.review_note}` : ""}</p> : <ReviewControls id={a.id} />}
      </li>
    );
  };
  return (
    <>
      <PageHeading lede="Members who want to become a call closer. Approving adds them to Call Closers for Hire with the price they gave, and tells them.">Call closer applications</PageHeading>
      <div className="stack" style={{ maxWidth: 760 }}>
        <h2 className="qh" style={{ margin: 0 }}>Waiting{pending.length ? ` · ${pending.length}` : ""}</h2>
        {pending.length === 0 ? <p className="page-lede" style={{ margin: 0 }}>Nothing waiting. 🎉</p> : <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>{pending.map((a) => row(a, false))}</ul>}
        {done.length ? <><h2 className="qh" style={{ margin: "10px 0 0" }}>Answered</h2><ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>{done.map((a) => row(a, true))}</ul></> : null}
      </div>
    </>
  );
}
