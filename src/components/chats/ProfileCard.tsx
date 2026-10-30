"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { openDockChat } from "@/components/messages/MessageDock";
import { facebookUrl, instagramUrl } from "@/lib/landing/types";

export type MemberPerson = { id: string; first_name: string | null; last_name: string | null; username: string | null; avatar_url: string | null; instagram: string | null; facebook: string | null; is_admin: boolean; birth_month: number | null; birth_day: number | null; birth_year: number | null; call_closer: boolean; offers_services: boolean };
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const fullName = (p: Pick<MemberPerson, "first_name" | "last_name">) => [p.first_name, p.last_name].filter(Boolean).join(" ") || "Member";
export const initialsOf = (p: Pick<MemberPerson, "first_name" | "last_name">) => ((p.first_name ?? "").charAt(0) + (p.last_name ?? "").charAt(0)).toUpperCase() || "?";

/** A profile bubble: picture (click to enlarge) beside the name, birthday, tags, social icons and a Message button. A guest speaker only shows a picture, a name and "Guest Speaker". */
export function ProfileCard({ p, guest = false, canMessage, onBack, onClose }: { p: MemberPerson; guest?: boolean; canMessage: boolean; onBack?: () => void; onClose: () => void }) {
  const [zoom, setZoom] = useState(false);
  if (zoom && p.avatar_url) {
    return (
      <button type="button" className="member-zoom" onClick={() => setZoom(false)} aria-label="Close the large picture">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.avatar_url} alt={fullName(p)} />
      </button>
    );
  }
  return (
  <div className="member-profile">
    {onBack ? <button type="button" className="linkbtn" onClick={onBack}>← Back to the list</button> : null}
    <div className="member-card">
    <div className="member-side">
    {p.avatar_url ? (
      <button type="button" className="member-photo" onClick={() => setZoom(true)} aria-label={`Enlarge ${fullName(p)}'s picture`} title="Click to enlarge">
        <Avatar url={p.avatar_url} initials={initialsOf(p)} size={140} />
      </button>
    ) : <Avatar url={null} initials={initialsOf(p)} size={140} />}
    </div>
    <div className="member-info">
    <h2 className="qh" style={{ margin: 0 }}>{fullName(p)}</h2>
    {guest ? <p className="when" style={{ margin: 0 }}>Guest Speaker</p> : p.username ? <p className="when" style={{ margin: 0 }}>@{p.username}{p.is_admin ? " · Admin" : ""}</p> : null}
    {p.birth_month && p.birth_day ? <p className="member-birthday">🎂 {MONTHS[p.birth_month - 1]} {p.birth_day}{p.birth_year ? `, ${p.birth_year}` : ""}</p> : null}
    {p.offers_services || p.call_closer ? (
      <ul className="member-tags" aria-label="What they offer">
        {p.offers_services ? <li><Link href="/outsourcing" onClick={() => onClose()}>Offers services in Outsourcing</Link></li> : null}
        {p.call_closer ? <li><span>Call closer</span></li> : null}
      </ul>
    ) : null}
    {p.instagram || p.facebook ? <ul className="member-social" aria-label="Social profiles">
      {p.instagram ? (
        <li><a href={instagramUrl(p.instagram)} target="_blank" rel="noopener noreferrer" aria-label={`Instagram: @${p.instagram}`}>
          <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
            <defs><radialGradient id="ig-grad" cx="30%" cy="107%" r="150%"><stop offset="0" stopColor="#FED576" /><stop offset=".26" stopColor="#F47133" /><stop offset=".61" stopColor="#BC3081" /><stop offset="1" stopColor="#4C63D2" /></radialGradient></defs>
            <rect x="1" y="1" width="22" height="22" rx="6.5" fill="url(#ig-grad)" />
            <rect x="5.4" y="5.4" width="13.2" height="13.2" rx="4" fill="none" stroke="#fff" strokeWidth="1.8" />
            <circle cx="12" cy="12" r="3.1" fill="none" stroke="#fff" strokeWidth="1.8" />
            <circle cx="16.4" cy="7.6" r="1" fill="#fff" />
          </svg>
        </a></li>
      ) : null}
      {p.facebook ? (
        <li><a href={facebookUrl(p.facebook)} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
          <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="11" fill="#1877F2" />
            <path fill="#fff" d="M13.4 22v-7.6h2.5l.4-3h-2.9V9.5c0-.9.3-1.5 1.5-1.5h1.5V5.3c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.5V22z" />
          </svg>
        </a></li>
      ) : null}
    </ul> : null}
    {canMessage && !guest && p.username ? (
      <button type="button" className="btn" onClick={() => { openDockChat(p.id); onClose(); }}>Message</button>
    ) : null}
    </div>
    </div>
  </div>

  );
}
