"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { forwardMessage, type FwdSource } from "@/app/(app)/chats/actions";
import { Avatar } from "@/components/Avatar";
import { createClient } from "@/lib/supabase/client";

type Chat = { id: string; slug: string; name: string; posting: string; min_role: string };
type Person = { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null };
type Group = { id: string; name: string };
const RANK: Record<string, number> = { lead: 1, member: 2, admin: 3 };
const nameOf = (p: Person) => [p.first_name, p.last_name].filter(Boolean).join(" ") || "Member";

/** "Forward to…": choose a chat, a group or a person, and a copy of the message is sent there. */
export function ForwardDialog({ source, me, onClose }: { source: FwdSource; me: string; onClose: () => void }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<"chats" | "groups" | "people">("chats");
  const [q, setQ] = useState("");
  const [chats, setChats] = useState<Chat[] | null>(null);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => { dlg.current?.showModal(); }, []);
  useEffect(() => {
    let live = true;
    const db = createClient();
    void (async () => {
      const { data: prof } = await db.from("profiles").select("role").eq("id", me).maybeSingle();
      const rank = RANK[(prof as { role: string } | null)?.role ?? "lead"] ?? 1;
      const [c, g, p] = await Promise.all([
        db.from("chats").select("id, slug, name, posting, min_role, sort").order("section_id").order("sort"),
        db.rpc("group_overview"),
        db.rpc("messageable_people"),
      ]);
      if (!live) return;
      setChats(((c.data ?? []) as Chat[]).filter((x) => (RANK[x.min_role] ?? 9) <= rank && (x.posting === "all" || rank === 3)));
      setGroups(((g.data ?? []) as Group[]));
      setPeople(((p.data ?? []) as Person[]).filter((x) => x.id !== me));
    })();
    return () => { live = false; };
  }, [me]);

  const go = (kind: "chat" | "group" | "dm", id: string, slug?: string) => start(async () => {
    setMsg("");
    const r = await forwardMessage(source, { kind, id, slug });
    if (!r.ok) { setMsg(r.error ?? "That did not work."); return; }
    dlg.current?.close();
  });
  const ql = q.trim().toLowerCase();
  return (
    <dialog ref={dlg} className="rs-dialog" aria-label="Forward to" onClose={onClose} onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}>
      <div className="set-form">
        <h2 className="qh" style={{ margin: 0 }}>Forward to…</h2>
        <div className="fwd-tabs" role="tablist">
          {(["chats", "groups", "people"] as const).map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t === "chats" ? "Chats" : t === "groups" ? "Group chats" : "People"}</button>)}
        </div>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search" />
        <ul className="fwd-list">
          {tab === "chats" ? (chats === null ? <li className="when">Loading…</li> : chats.filter((c) => c.name.toLowerCase().includes(ql)).map((c) => <li key={c.id}><button type="button" disabled={pending} onClick={() => go("chat", c.id, c.slug)}><span translate="no">{c.name}</span></button></li>)) : null}
          {tab === "groups" ? (groups === null ? <li className="when">Loading…</li> : groups.length === 0 ? <li className="when">You are not in any groups yet.</li> : groups.filter((g) => g.name.toLowerCase().includes(ql)).map((g) => <li key={g.id}><button type="button" disabled={pending} onClick={() => go("group", g.id)}><span translate="no">{g.name}</span></button></li>)) : null}
          {tab === "people" ? (people === null ? <li className="when">Loading…</li> : people.filter((p) => nameOf(p).toLowerCase().includes(ql)).slice(0, 60).map((p) => <li key={p.id}><button type="button" disabled={pending} onClick={() => go("dm", p.id)}><Avatar url={p.avatar_url} initials={nameOf(p).charAt(0).toUpperCase()} size={32} /><span translate="no">{nameOf(p)}</span></button></li>)) : null}
        </ul>
        {msg ? <p className="err" role="alert" style={{ minHeight: 0 }}>{msg}</p> : null}
        <div className="dlg-actions"><button type="button" className="btn" onClick={() => dlg.current?.close()}>Cancel</button></div>
      </div>
    </dialog>
  );
}
