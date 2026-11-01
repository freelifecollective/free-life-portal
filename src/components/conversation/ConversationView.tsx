"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteComment, deletePost, sendMessage } from "@/app/(app)/chats/actions";
import { deleteGroupMessage, sendGroupMessage } from "@/app/(app)/groups/actions";
import { Avatar } from "@/components/Avatar";
import { PersonLink } from "@/components/people/ProfilePopup";
import { Reactions } from "@/components/chats/Reactions";
import { UserText } from "@/components/UserText";
import { timeET, toRows, type Msg } from "@/lib/chats/messages";

const snippet = (s: string) => (s.length > 90 ? s.slice(0, 88) + "…" : s);

/**
 * A conversation like Telegram: oldest at the top, newest at the bottom, your messages on the right, a box at the bottom to write in,
 * replies that quote the message they answer, and the view stays at the bottom as new messages come in.
 */
export function ConversationView({ messages, kind, targetId, slug = "", canPost, placeholder, moreHref, nowIso, readOnlyText }: {
  messages: Msg[]; kind: "chat" | "group"; targetId: string; slug?: string; canPost: boolean; placeholder: string; moreHref?: string; nowIso: string; readOnlyText?: string;
}) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const stick = useRef(true);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const rows = toRows(messages, nowIso);
  const lastId = messages[messages.length - 1]?.id;

  /* stay at the bottom while you are there; if you scrolled up to read, leave the view alone */
  useEffect(() => {
    const el = box.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [lastId, messages.length]);
  const onScroll = () => { const el = box.current; if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140; };

  const send = () => {
    const body = text.trim();
    if (!body || pending) return;
    start(async () => {
      setError("");
      const r = kind === "chat" ? await sendMessage(targetId, slug, body, replyTo?.legacy ? null : replyTo?.id ?? null) : await sendGroupMessage(targetId, body, replyTo?.id ?? null);
      if (!r.ok) { setError(r.error ?? "That did not work."); return; }
      setText(""); setReplyTo(null); stick.current = true;
      if (area.current) area.current.style.height = "";
      router.refresh();
    });
  };
  const remove = (m: Msg) => {
    if (!window.confirm("Delete this message?")) return;
    start(async () => {
      const r = kind === "group" ? await deleteGroupMessage(m.id) : m.legacy ? await deleteComment(m.id, slug) : await deletePost(m.id, slug);
      if (!r.ok) setError(r.error ?? "That did not work."); else router.refresh();
    });
  };
  const jump = (id: string) => { const el = document.getElementById(`m-${id}`); if (el) { stick.current = false; el.scrollIntoView({ block: "center", behavior: "smooth" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1400); } };

  return (
    <div className="cv">
      <div className="cv-scroll" ref={box} onScroll={onScroll} role="log" aria-live="polite" aria-label="Messages">
        {moreHref ? <p className="cv-more"><Link className="btn small" href={moreHref} scroll={false}>Show earlier messages</Link></p> : null}
        {rows.length === 0 ? <p className="cv-empty">No messages yet. Say hello!</p> : null}
        {rows.map((r) => {
          if (r.kind === "day") return <p key={"d" + r.key} className="cv-day"><span>{r.label}</span></p>;
          const { m, first, last } = r;
          return (
            <div key={m.id} id={`m-${m.id}`} className={"cv-row" + (m.mine ? " mine" : "") + (first ? " first" : "") + (last ? " last" : "")}>
              {!m.mine ? <span className="cv-av">{last ? <PersonLink id={m.author.id} name={m.author.name}><Avatar url={m.author.avatar_url} initials={m.author.name.charAt(0).toUpperCase()} size={34} /></PersonLink> : null}</span> : null}
              <div className="cv-col">
                <div className="cv-bubble">
                  {!m.mine && first ? <PersonLink id={m.author.id} name={m.author.name} className="cv-name"><strong>{m.author.name}</strong>{m.author.is_admin ? <small className="admin-tag">Admin</small> : null}</PersonLink> : null}
                  {m.replyTo ? (
                    <button type="button" className="cv-quote" onClick={() => jump(m.replyTo!.id)}><b translate="no">{m.replyTo.name}</b><span translate="no">{snippet(m.replyTo.body)}</span></button>
                  ) : null}
                  <p className="cv-text"><UserText text={m.body} /></p>
                  <span className="cv-meta"><time dateTime={m.created_at}>{timeET(m.created_at)}</time></span>
                </div>
                <div className="cv-tools">
                  {canPost ? <button type="button" className="cv-tool" onClick={() => { setReplyTo(m); area.current?.focus(); }}>Reply</button> : null}
                  {kind === "chat" && !m.legacy ? <Reactions postId={m.id} slug={slug} reactions={m.reactions ?? []} mine={m.myReaction ?? null} onError={setError} /> : null}
                  {m.canDelete ? <button type="button" className="cv-tool danger" onClick={() => remove(m)}>Delete</button> : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {canPost ? (
        <div className="cv-composer">
          {replyTo ? <div className="cv-replying"><span><b translate="no">{replyTo.author.name}</b> <span translate="no">{snippet(replyTo.body)}</span></span><button type="button" className="linkbtn" onClick={() => setReplyTo(null)} aria-label="Cancel reply">✕</button></div> : null}
          <div className="cv-input">
            <textarea ref={area} rows={1} maxLength={4000} value={text} placeholder={placeholder} aria-label="Write a message"
              onChange={(e) => { setText(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(160, e.target.scrollHeight) + "px"; }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
            <button type="button" className="btn primary" disabled={pending || !text.trim()} onClick={send} aria-label="Send">{pending ? "…" : "Send"}</button>
          </div>
          {error ? <p className="err" role="alert" style={{ minHeight: 0, margin: "6px 0 0" }}>{error}</p> : null}
        </div>
      ) : <p className="when" style={{ margin: "10px 4px 0" }}>{readOnlyText ?? "Only admins can post here."}</p>}
    </div>
  );
}
