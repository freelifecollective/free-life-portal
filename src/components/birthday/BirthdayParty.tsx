"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { postWish, removeWish } from "@/app/(app)/birthday/actions";
import { Avatar } from "@/components/Avatar";
import { downloadBirthdayCard } from "./drawCard";

export type Wish = { id: string; author_id: string; first_name: string | null; last_name: string | null; avatar_url: string | null; body: string; created_at: string; mine: boolean };

const nameOf = (w: { first_name: string | null; last_name: string | null }) => [w.first_name, w.last_name].filter(Boolean).join(" ") || "A member";

/** The birthday chat for one person and day. While the day is on, paying affiliates add wishes. Afterwards the birthday person keeps the wishes as a card they can download. */
export function BirthdayParty({ personId, name, year, isOpen, isMe, isAdmin, wishes, otherYears }: {
  personId: string; name: string; year: number; isOpen: boolean; isMe: boolean; isAdmin: boolean; wishes: Wish[]; otherYears: { year: number; wishes: number }[];
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const send = () => start(async () => {
    setMsg("");
    const r = await postWish(personId, year, text);
    if (!r.ok) { setMsg(r.error ?? ""); return; }
    setText(""); router.refresh();
  });
  const save = async () => {
    setMsg("");
    try { await downloadBirthdayCard(name, year, wishes.map((w) => ({ author: nameOf(w), body: w.body }))); } catch { setMsg("We could not make the card. Please try again."); }
  };
  return (
    <div className="bday-page">
      {isOpen && !isMe ? (
        <form className="card-s bday-compose" onSubmit={(e) => { e.preventDefault(); if (text.trim()) send(); }}>
          <label htmlFor="bday-text" className="when">{`Write a birthday wish for ${name}`}</label>
          <textarea id="bday-text" rows={3} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="Happy birthday! 🎉" />
          <div className="rs-actions" style={{ marginTop: 6 }}><button type="submit" className="btn primary small" disabled={pending || !text.trim()}>{pending ? "Posting…" : "Post wish"}</button></div>
        </form>
      ) : null}
      {isOpen && isMe ? <p className="when">It&apos;s your birthday! Everyone&apos;s wishes will gather here, and tonight they become a card you can keep.</p> : null}
      {!isOpen && !isMe ? <p className="when">This birthday chat has finished. Birthday wishes are open on the day.</p> : null}
      {msg ? <p className="err" role="alert">{msg}</p> : null}
      {wishes.length === 0 ? <p className="page-lede" style={{ margin: 0 }}>{isOpen ? "No wishes yet. Be the first!" : "No wishes were left on this day."}</p> : (
        <ul className="bday-list">
          {wishes.map((w) => (
            <li key={w.id} className="card-s bday-wish">
              <Avatar url={w.avatar_url} initials={((w.first_name ?? "").charAt(0) + (w.last_name ?? "").charAt(0)).toUpperCase() || "?"} size={36} label={nameOf(w)} />
              <div>
                <strong translate="no">{nameOf(w)}</strong>
                <p style={{ margin: "2px 0 0", whiteSpace: "pre-wrap" }} translate="no">{w.body}</p>
                {(w.mine || isAdmin) && isOpen ? <button type="button" className="linkbtn danger" onClick={() => start(async () => { await removeWish(w.id, personId); router.refresh(); })}>Remove</button> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {isMe && wishes.length > 0 ? <div className="rs-actions"><button type="button" className="btn primary" onClick={save}>Download your birthday card</button></div> : null}
      {isMe && otherYears.length > 0 ? (
        <section>
          <h2 className="qh">Your birthday cards</h2>
          <p style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{otherYears.map((o) => <Link key={o.year} className={"btn small" + (o.year === year ? " primary" : "")} href={`/birthday/${personId}?y=${o.year}`}>{`${o.year} · ${o.wishes}`}</Link>)}</p>
        </section>
      ) : null}
    </div>
  );
}
