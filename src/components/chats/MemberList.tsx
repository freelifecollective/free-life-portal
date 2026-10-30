"use client";

import { useEffect, useRef, useState } from "react";
import { SocialButtons } from "@/components/landing/SocialButtons";
import { Avatar } from "@/components/Avatar";
import { openDockChat } from "@/components/messages/MessageDock";
import { createClient } from "@/lib/supabase/client";

type Person = { id: string; first_name: string | null; last_name: string | null; username: string | null; avatar_url: string | null; instagram: string | null; facebook: string | null; is_admin: boolean };
const name = (p: Person) => [p.first_name, p.last_name].filter(Boolean).join(" ") || "Member";
const initials = (p: Person) => ((p.first_name ?? "").charAt(0) + (p.last_name ?? "").charAt(0)).toUpperCase() || "?";

/** A section heading you can click: it opens a popup listing everyone in that group. Choosing a name shows their profile and a Message button. */
export function MemberList({ kind, title, children, canMessage }: { kind: "affiliates" | "leads"; title: string; children: React.ReactNode; canMessage: boolean }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [picked, setPicked] = useState<Person | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || people) return;
    let live = true;
    void createClient().rpc("member_directory", { p_kind: kind }).then(({ data }) => { if (live) setPeople((data ?? []) as Person[]); });
    return () => { live = false; };
  }, [open, people, kind]);

  function show() { setPicked(null); setQ(""); setOpen(true); dlg.current?.showModal(); }
  const shown = (people ?? []).filter((p) => name(p).toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <>
      <h2 className="chat-section"><button type="button" className="chat-section-btn" onClick={show} aria-haspopup="dialog">{children}</button></h2>
      <dialog ref={dlg} className="rs-dialog members-dialog" aria-label={title} onClose={() => setOpen(false)}
        onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}>
        {picked ? (
          <div className="member-profile">
            <button type="button" className="linkbtn" onClick={() => setPicked(null)}>← Back to the list</button>
            <Avatar url={picked.avatar_url} initials={initials(picked)} size={96} />
            <h2 className="qh" style={{ margin: "8px 0 0" }}>{name(picked)}</h2>
            {picked.username ? <p className="when" style={{ margin: 0 }}>@{picked.username}{picked.is_admin ? " · Admin" : ""}</p> : null}
            <SocialButtons instagram={picked.instagram} facebook={picked.facebook} />
            {canMessage && picked.username ? (
              <button type="button" className="btn" onClick={() => { openDockChat(picked.id); dlg.current?.close(); }}>Message</button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="members-head">
              <h2 className="qh" style={{ margin: 0 }}>{title}{people ? <span className="when"> · {people.length}</span> : null}</h2>
              <button type="button" className="linkbtn" onClick={() => dlg.current?.close()}>Close</button>
            </div>
            <input type="search" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search by name" />
            <ul className="members-list">
              {shown.map((p) => (
                <li key={p.id}><button type="button" onClick={() => setPicked(p)}><Avatar url={p.avatar_url} initials={initials(p)} size={40} /><span>{name(p)}</span></button></li>
              ))}
              {!people ? <li className="dock-empty">Loading…</li> : null}
              {people && shown.length === 0 ? <li className="dock-empty">{people.length === 0 ? "No one here yet." : "No one matches that search."}</li> : null}
            </ul>
          </>
        )}
      </dialog>
    </>
  );
}
