"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { createClient } from "@/lib/supabase/client";

export type Pickable = { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null; lead?: boolean };
const nameOf = (p: Pickable) => [p.first_name, p.last_name].filter(Boolean).join(" ") || "Member";

/** Search affiliates and new members and tick the ones you want. People already in `exclude` are left out. */
export function MemberPicker({ selected, onChange, exclude = [] }: { selected: string[]; onChange: (ids: string[]) => void; exclude?: string[] }) {
  const [people, setPeople] = useState<Pickable[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    let live = true;
    const db = createClient();
    void Promise.all([db.rpc("member_directory", { p_kind: "affiliates" }), db.rpc("member_directory", { p_kind: "leads" })]).then(([a, l]) => {
      if (live) setPeople([...((a.data ?? []) as Pickable[]), ...((l.data ?? []) as Pickable[]).map((p) => ({ ...p, lead: true }))]);
    });
    return () => { live = false; };
  }, []);
  const list = (people ?? []).filter((p) => !exclude.includes(p.id) && nameOf(p).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 80);
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div className="mp">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" aria-label="Search people" />
      <ul className="mp-list">
        {people === null ? <li className="when">Loading…</li> : list.length === 0 ? <li className="when">No one found.</li> : list.map((p) => (
          <li key={p.id}>
            <label><input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
              <Avatar url={p.avatar_url} initials={nameOf(p).charAt(0).toUpperCase()} size={32} /><span translate="no">{nameOf(p)}</span>{p.lead ? <small className="when">New member</small> : null}</label>
          </li>
        ))}
      </ul>
      <p className="when" style={{ margin: 0 }}>{`${selected.length} chosen`}</p>
    </div>
  );
}
