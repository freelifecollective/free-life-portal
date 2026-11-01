"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addMembers, removeMember, renameGroup } from "@/app/(app)/groups/actions";
import { Avatar } from "@/components/Avatar";
import { PersonLink } from "@/components/people/ProfilePopup";
import { MemberPicker } from "./MemberPicker";

export type GroupMember = { id: string; name: string; avatar_url: string | null; owner: boolean };

/** Who is in the group, add or remove people (owner), rename it (owner), or leave. */
export function GroupSettings({ groupId, name, members, me, isOwner }: { groupId: string; name: string; members: GroupMember[]; me: string; isOwner: boolean }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [title, setTitle] = useState(name);
  const [adding, setAdding] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => start(async () => {
    setMsg("");
    const r = await fn();
    if (!r.ok) { setMsg(r.error ?? "That did not work."); return; }
    after?.(); router.refresh();
  });
  return (
    <>
      <button type="button" className="btn small" onClick={() => dlg.current?.showModal()}>{`${members.length} people · Group info`}</button>
      <dialog ref={dlg} className="rs-dialog" aria-label="Group info" onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}>
        <div className="set-form">
          <h2 className="qh" style={{ margin: 0 }} translate="no">{name}</h2>
          {isOwner ? (
            <form className="rs-actions" style={{ marginTop: 0 }} onSubmit={(e) => { e.preventDefault(); run(() => renameGroup(groupId, title)); }}>
              <input type="text" maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Group name" style={{ font: "inherit", border: "1px solid var(--line)", borderRadius: 10, padding: "8px 12px", flex: "1 1 200px" }} />
              <button className="btn small" type="submit" disabled={pending || !title.trim() || title.trim() === name}>Rename</button>
            </form>
          ) : null}
          <ul className="mp-list">
            {members.map((m) => (
              <li key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
                <PersonLink id={m.id} name={m.name} className="who"><Avatar url={m.avatar_url} initials={m.name.charAt(0).toUpperCase()} size={32} /><span className="who-name"><strong translate="no">{m.name}</strong>{m.owner ? <small className="admin-tag">Owner</small> : null}</span></PersonLink>
                {isOwner && m.id !== me ? <button type="button" className="linkbtn danger" disabled={pending} onClick={() => run(() => removeMember(groupId, m.id))}>Remove</button> : null}
              </li>
            ))}
          </ul>
          {isOwner ? (
            <div className="field"><span className="when">Add people</span>
              <MemberPicker selected={adding} onChange={setAdding} exclude={members.map((m) => m.id)} />
              <button type="button" className="btn small primary" disabled={pending || adding.length === 0} onClick={() => run(() => addMembers(groupId, adding), () => setAdding([]))}>Add to group</button></div>
          ) : null}
          {msg ? <p className="err" role="alert" style={{ minHeight: 0 }}>{msg}</p> : null}
          <div className="dlg-actions">
            <button type="button" className="linkbtn danger" disabled={pending} onClick={() => { if (window.confirm("Leave this group?")) run(() => removeMember(groupId, me), () => router.push("/groups")); }}>Leave group</button>
            <button type="button" className="btn" onClick={() => dlg.current?.close()}>Close</button>
          </div>
        </div>
      </dialog>
    </>
  );
}
