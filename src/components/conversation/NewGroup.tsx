"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createGroup } from "@/app/(app)/groups/actions";
import { MemberPicker } from "./MemberPicker";

/** "New group": name it and choose who is in it. You can add and remove people later. */
export function NewGroup() {
  const dlg = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [name, setName] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" className="chat-new" onClick={() => dlg.current?.showModal()} title="Create a group">+ Create a Group</button>
      <dialog ref={dlg} className="rs-dialog" aria-label="New group" onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}>
        <form className="set-form" onSubmit={(e) => { e.preventDefault(); start(async () => { setError(""); const r = await createGroup(name, ids); if (!r.ok) { setError(r.error); return; } dlg.current?.close(); setName(""); setIds([]); router.push(`/groups/${r.id}`); router.refresh(); }); }}>
          <h2 className="qh" style={{ margin: 0 }}>New group</h2>
          <div className="field"><label htmlFor="ng-name">Group name</label><input id="ng-name" type="text" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
          <div className="field"><span className="when">Add people</span><MemberPicker selected={ids} onChange={setIds} /></div>
          <p className="err" role="alert" style={{ minHeight: 0 }}>{error}</p>
          <div className="dlg-actions"><button className="btn" type="button" onClick={() => dlg.current?.close()}>Cancel</button><button className="btn primary" type="submit" disabled={pending}>{pending ? "Creating…" : "Create group"}</button></div>
        </form>
      </dialog>
    </>
  );
}
