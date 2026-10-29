"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Person } from "@/lib/messages/queries";

export function NewMessage({ people }: { people: Person[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const name = (p: Person) => [p.first_name, p.last_name].filter(Boolean).join(" ");
  const hits = q.trim() ? people.filter((p) => name(p).toLowerCase().includes(q.trim().toLowerCase()) || (p.username ?? "").includes(q.trim().toLowerCase())).slice(0, 8) : [];
  if (!open) return <p style={{ margin: 0 }}><button className="btn primary" type="button" onClick={() => setOpen(true)}>New message</button></p>;
  return (
    <section className="card-s">
      <div className="field"><label htmlFor="nm-q">Who do you want to message?</label><input id="nm-q" type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or username" autoFocus /></div>
      {hits.length ? (
        <ul className="pick-list">{hits.map((p) => <li key={p.id}><button type="button" onClick={() => router.push(`/messages/${p.username}`)}><strong>{name(p)}</strong><span className="when">@{p.username}{p.is_admin ? " · Admin" : ""}</span></button></li>)}</ul>
      ) : q.trim() ? <p className="when" style={{ margin: "10px 0 0" }}>No one found.</p> : null}
      <p style={{ margin: "12px 0 0" }}><button className="linkbtn" type="button" onClick={() => { setOpen(false); setQ(""); }}>Cancel</button></p>
    </section>
  );
}
