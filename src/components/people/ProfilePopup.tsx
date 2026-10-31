"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { ProfileCard, type MemberPerson } from "@/components/chats/ProfileCard";
import { createClient } from "@/lib/supabase/client";

type Found = { found: boolean; viewer_is_member: boolean } & MemberPerson;
type Shown = { person: MemberPerson; canMessage: boolean };
type Open = (id: string) => void;

const Ctx = createContext<Open | null>(null);

/** One shared profile bubble for the whole portal. Anything showing a person can open it with <PersonLink>. */
export function ProfilePopupProvider({ children }: { children: ReactNode }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const [busy, setBusy] = useState(false);

  async function open(id: string) {
    if (busy) return;
    setBusy(true);
    const { data } = await createClient().rpc("speaker_profile", { p_id: id });
    setBusy(false);
    const r = (data as Found[] | null)?.[0];
    if (!r?.found) return;
    setShown({ person: r, canMessage: r.viewer_is_member });
    if (!dlg.current?.open) dlg.current?.showModal();
  }

  return (
    <Ctx.Provider value={open}>
      {children}
      <dialog ref={dlg} className="rs-dialog members-dialog" aria-label="Profile" onClose={() => setShown(null)}
        onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}>
        {shown ? <ProfileCard p={shown.person} canMessage={shown.canMessage} onClose={() => dlg.current?.close()} /> : null}
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
