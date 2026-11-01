"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { ProfileCard, type MemberPerson, type View } from "@/components/chats/ProfileCard";
import { createClient } from "@/lib/supabase/client";

type Found = { found: boolean; viewer_is_member: boolean } & MemberPerson;
type Shown = { person: MemberPerson; canMessage: boolean; view: View };
type Open = (id: string, view?: View) => void;

const Ctx = createContext<Open | null>(null);

/** One shared profile bubble for the whole portal. Anything showing a person can open it with <PersonLink>. */
export function ProfilePopupProvider({ children }: { children: ReactNode }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const [busy, setBusy] = useState(false);

  async function open(id: string, view: View = "profile") {
    if (busy) return;
    setBusy(true);
    const { data } = await createClient().rpc("speaker_profile", { p_id: id });
    setBusy(false);
    const r = (data as Found[] | null)?.[0];
    if (!r?.found) return;
    setShown({ person: r, canMessage: r.viewer_is_member, view });
    if (!dlg.current?.open) dlg.current?.showModal();
  }

  return (
    <Ctx.Provider value={open}>
      {children}
      <dialog ref={dlg} className="rs-dialog members-dialog" aria-label="Profile" onClose={() => setShown(null)}
        onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}>
        {shown ? <ProfileCard key={shown.person.id + shown.view} p={shown.person} startView={shown.view} canMessage={shown.canMessage} onClose={() => dlg.current?.close()} /> : null}
      </dialog>
    </Ctx.Provider>
  );
}

/** Wraps a person's picture and/or name so pressing it opens their profile. With no id (or outside the portal) it is just plain content. */
export function PersonLink({ id, name, className = "", children }: { id?: string | null; name: string; className?: string; children: ReactNode }) {
  const open = useContext(Ctx);
  if (!id || !open) return <span className={className}>{children}</span>;
  return (
    <button type="button" className={"person-link " + className} onClick={() => open(id)} aria-label={`See ${name}'s profile`}>{children}</button>
  );
}

/** For a picture that sits inside a row that is already a button or a link: pressing the picture itself opens the profile, pressing the rest does what the row does. */
export function PersonTap({ id, name, children }: { id?: string | null; name: string; children: ReactNode }) {
  const open = useContext(Ctx);
  if (!id || !open) return <>{children}</>;
  const go = (e: { preventDefault: () => void; stopPropagation: () => void }) => { e.preventDefault(); e.stopPropagation(); open(id); };
  return (
    <span role="button" tabIndex={0} className="person-tap" aria-label={`See ${name}'s profile`} onClick={go} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") go(e); }}>{children}</span>
  );
}

/** A button that opens someone's profile (optionally straight on their call closer view). */
export function ProfileButton({ id, view, className = "btn small", children }: { id: string; view?: View; className?: string; children: ReactNode }) {
  const open = useContext(Ctx);
  return <button type="button" className={className} onClick={() => open?.(id, view)}>{children}</button>;
}
