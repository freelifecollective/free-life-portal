"use client";

import { Fragment, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { ProfileCard, type MemberPerson } from "@/components/chats/ProfileCard";
import { createClient } from "@/lib/supabase/client";
import type { Speaker } from "@/lib/calls/types";

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("") || "?";

/** "Sonya & Lacey" / "Sonya, Lacey & Maya" */
export function speakerNames(list: Speaker[]): string {
  const names = list.map((s) => s.name);
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

type Found = { found: boolean; viewer_is_member: boolean } & MemberPerson;
type Shown = { person: MemberPerson; guest: boolean; canMessage: boolean };

/**
 * Round pictures of the people speaking on a call, slightly overlapping, with their names beside them.
 * With `profiles` on, a picture or name opens that person's profile bubble, or a "Guest Speaker" bubble if they are not in the community.
 */
export function SpeakerBubbles({ speakers, size = 52, label, profiles = false }: { speakers: Speaker[]; size?: number; label?: string | null; profiles?: boolean }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  if (speakers.length === 0) return null;
  /* "Speaker" for one person, "Speakers" for more (unless a label such as "Preview" is given) */
  const heading = label === undefined ? (speakers.length === 1 ? "Speaker" : "Speakers") : label;

  async function open(s: Speaker) {
    if (!profiles || busy) return;
    setBusy(s.name);
    const { data } = await createClient().rpc("speaker_profile", { p_name: s.name });
    setBusy(null);
    const r = (data as Found[] | null)?.[0];
    const guestPerson: MemberPerson = { id: "", first_name: s.name, last_name: null, username: null, avatar_url: s.photo_url, instagram: null, facebook: null, is_admin: false, birth_month: null, birth_day: null, birth_year: null, call_closer: false, offers_services: false };
    if (r?.found) setShown({ person: { ...r, avatar_url: r.avatar_url ?? s.photo_url }, guest: false, canMessage: r.viewer_is_member });
    else setShown({ person: guestPerson, guest: true, canMessage: false });
    dlg.current?.showModal();
  }

  const names = speakers.map((s) => s.name);
  return (
    <div className="speakers">
      <ul className="speaker-bubbles" aria-label={heading ?? "Speakers"}>
        {speakers.map((s, i) => (
          <li key={s.name + i} title={s.name}>
            {profiles ? (
              <button type="button" className="speaker-hit" onClick={() => void open(s)} aria-label={`See ${s.name}'s profile`}><Avatar url={s.photo_url} initials={initials(s.name)} size={size} label={s.name} /></button>
            ) : <Avatar url={s.photo_url} initials={initials(s.name)} size={size} label={s.name} />}
          </li>
        ))}
      </ul>
      <span className="speaker-names">
        {heading ? <small>{heading}</small> : null}
        <strong>
          {names.map((n, i) => (
            <Fragment key={n + i}>
              {i > 0 ? (i === names.length - 1 ? " & " : ", ") : null}
              {profiles ? <button type="button" className="speaker-name-btn" onClick={() => void open(speakers[i])}>{n}</button> : n}
            </Fragment>
          ))}
        </strong>
      </span>
      {profiles ? (
        <dialog ref={dlg} className="rs-dialog members-dialog" aria-label="Speaker profile" onClose={() => setShown(null)}
          onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}>
          {shown ? <ProfileCard p={shown.person} guest={shown.guest} canMessage={shown.canMessage} onClose={() => dlg.current?.close()} /> : null}
        </dialog>
      ) : null}
    </div>
  );
}
