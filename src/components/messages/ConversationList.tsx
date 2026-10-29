"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import type { Conversation } from "@/lib/messages/queries";
import { formatInZone } from "@/lib/time";

const name = (p: Conversation["other"]) => [p.first_name, p.last_name].filter(Boolean).join(" ") || "Member";

/** Your conversations. The eye opens a preview of the latest messages and does NOT send a Read receipt. */
export function ConversationList({ items, me }: { items: Conversation[]; me: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [peek, setPeek] = useState<Conversation | null>(null);
  if (items.length === 0) return <section className="card-s"><p style={{ margin: 0 }}>No messages yet. Press New message to start one.</p></section>;
  return (
    <>
      <ul className="convo-list">
        {items.map((c) => (
          <li key={c.other.id} className={c.unread ? "unread" : ""}>
            <Link href={`/messages/${c.other.username}`} className="convo-main">
              <Avatar url={c.other.avatar_url} initials={name(c.other).charAt(0).toUpperCase()} size={44} />
              <span className="convo-text">
                <strong>{name(c.other)}{c.other.is_admin ? <small className="admin-tag"> Admin</small> : null}</strong>
                <span className="convo-last">{c.last.sender_id === me ? "You: " : ""}{c.last.body}</span>
              </span>
              <span className="convo-meta"><time className="when" dateTime={c.last.created_at}>{formatInZone(new Date(c.last.created_at))}</time>{c.unread ? <span className="badge">{c.unread}</span> : null}</span>
            </Link>
            {c.unread ? (
              <button type="button" className="peek" aria-label={`Peek at messages from ${name(c.other)} without marking them read`} onClick={() => { setPeek(c); dialog.current?.showModal(); }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <dialog ref={dialog} className="rs-dialog" aria-labelledby="peek-title" onClose={() => setPeek(null)}>
        {peek ? (
          <div>
            <h2 id="peek-title" className="qh" style={{ marginTop: 0 }}>Peek: {name(peek.other)}</h2>
            <p className="when" style={{ margin: "0 0 12px" }}>{name(peek.other)} will not see a Read receipt.</p>
            <ul className="thread">
              {peek.preview.map((m) => <li key={m.id} className={m.sender_id === me ? "mine" : "theirs"}><div className="bubble">{m.body}</div><span className="when">{formatInZone(new Date(m.created_at))}</span></li>)}
            </ul>
            <div className="dlg-actions"><button className="btn" type="button" onClick={() => dialog.current?.close()}>Close</button><Link className="btn primary" href={`/messages/${peek.other.username}`} style={{ textDecoration: "none" }}>Open and reply</Link></div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
