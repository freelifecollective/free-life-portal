"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { createClient } from "@/lib/supabase/client";
import { ProfileCard, fullName as name, initialsOf as initials, type MemberPerson as Person } from "./ProfileCard";

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
          <ProfileCard p={picked} canMessage={canMessage} onBack={() => setPicked(null)} onClose={() => dlg.current?.close()} />
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
