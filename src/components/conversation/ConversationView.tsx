"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteComment, deletePost, editMessage, pinPost, searchMessages, sendMessage, type Hit } from "@/app/(app)/chats/actions";
import { deleteGroupMessage, sendGroupMessage } from "@/app/(app)/groups/actions";
import { Avatar } from "@/components/Avatar";
import { PersonLink } from "@/components/people/ProfilePopup";
import { Reactions } from "@/components/chats/Reactions";
import { UserText } from "@/components/UserText";
import { VoiceNote } from "@/components/voice/VoiceNote";
import { VoiceRecorder } from "@/components/voice/VoiceRecorder";
import { EmojiPicker } from "@/components/chats/EmojiPicker";
import { dayLabel, timeET, toRows, type Msg } from "@/lib/chats/messages";

const snippet = (s: string) => (s.length > 90 ? s.slice(0, 88) + "…" : s);

/**
 * A conversation like Telegram: oldest at the top, newest at the bottom, your messages on the right, a box at the bottom to write in,
 * replies that quote the message they answer, and the view stays at the bottom as new messages come in.
 */
export function ConversationView({ messages, kind, targetId, slug = "", canPost, placeholder, moreHref, nowIso, readOnlyText, jumpTo, canPin = false, basePath }: {
  messages: Msg[]; kind: "chat" | "group"; targetId: string; slug?: string; canPost: boolean; placeholder: string; moreHref?: string; nowIso: string; readOnlyText?: string; jumpTo?: string; canPin?: boolean; basePath: string;
}) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const stick = useRef(true);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [tray, setTray] = useState<"emoji" | "gif" | null>(null);
  const [gifQ, setGifQ] = useState("");
  const [gifs, setGifs] = useState<{ enabled: boolean; results: { id: string; url: string; preview: string }[] } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; m: Msg } | null>(null);
  const [editing, setEditing] = useState<Msg | null>(null);
  const [find, setFind] = useState<{ open: boolean; q: string; hits: Hit[] | null }>({ open: false, q: "", hits: null });
  const [pinAt, setPinAt] = useState(0);
  const pinned = messages.filter((m) => m.pinned);
  const shownPin = pinned.length ? pinned[pinAt % pinned.length] : null;
  const rows = toRows(messages, nowIso);
  const lastId = messages[messages.length - 1]?.id;

  /* stay at the bottom while you are there; if you scrolled up to read, leave the view alone */
  useEffect(() => {
    const el = box.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [lastId, messages.length]);
  useEffect(() => {
    if (!jumpTo) return;
    const el = document.getElementById(`m-${jumpTo}`);
    if (el) { stick.current = false; el.scrollIntoView({ block: "center" }); el.classList.add("flash"); const t = setTimeout(() => el.classList.remove("flash"), 1800); return () => clearTimeout(t); }
  }, [jumpTo]);
  const onScroll = () => { const el = box.current; if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140; };

  /* the menu for a message closes when you click anywhere else */
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("mousedown", close); window.addEventListener("keydown", onKey); window.addEventListener("resize", close);
    box.current?.addEventListener("scroll", close);
    const el = box.current;
    return () => { window.removeEventListener("mousedown", close); window.removeEventListener("keydown", onKey); window.removeEventListener("resize", close); el?.removeEventListener("scroll", close); };
  }, [menu]);
  async function searchGifs(q: string) {
    try { setGifs((await (await fetch(`/api/gifs?q=${encodeURIComponent(q)}`)).json()) as { enabled: boolean; results: { id: string; url: string; preview: string }[] }); }
    catch { setGifs({ enabled: true, results: [] }); }
  }
  const addEmoji = (em: string) => {
    const el = area.current; const at = el?.selectionStart ?? text.length; const to = el?.selectionEnd ?? text.length;
    setText((t) => (t.slice(0, at) + em + t.slice(to)).slice(0, 4000));
    window.setTimeout(() => { el?.focus(); el?.setSelectionRange(at + em.length, at + em.length); }, 0);
  };
  const send = (image: string | null = null, voice: { url: string; secs: number } | null = null) => {
    const body = text.trim();
    if ((!body && !image && !voice) || pending) return;
    setTray(null);
    if (editing) {
      const target = editing;
      start(async () => {
        setError("");
        const r = await editMessage(kind, target.id, body);
        if (!r.ok) { setError(r.error ?? "That did not work."); return; }
        setText(""); setEditing(null);
        if (area.current) area.current.style.height = "";
        router.refresh();
      });
      return;
    }
    start(async () => {
      setError("");
      const r = kind === "chat" ? await sendMessage(targetId, slug, body, replyTo?.legacy ? null : replyTo?.id ?? null, image, voice) : await sendGroupMessage(targetId, body, replyTo?.id ?? null, image, voice);
      if (!r.ok) { setError(r.error ?? "That did not work."); return; }
      if (!image && !voice) setText("");
      setReplyTo(null); stick.current = true;
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
  const runFind = (q: string) => {
    setFind((f) => ({ ...f, q }));
    if (q.trim().length < 2) { setFind((f) => ({ ...f, hits: null })); return; }
    void searchMessages(kind, targetId, q).then((hits) => setFind((f) => (f.q === q ? { ...f, hits } : f)));
  };
  const jump = (id: string) => { const el = document.getElementById(`m-${id}`); if (!el) { router.push(`${basePath}?limit=300&jump=${id}`); return; } if (el) { stick.current = false; el.scrollIntoView({ block: "center", behavior: "smooth" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1400); } };

  return (
    <div className="cv">
      <button type="button" className={"cv-find-btn" + (find.open ? " on" : "")} aria-label="Search this chat" title="Search this chat" aria-expanded={find.open} onClick={() => setFind((f) => ({ open: !f.open, q: "", hits: null }))}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      </button>
      {find.open ? (
        <div className="cv-find">
          <input type="search" autoFocus placeholder="Search this chat" aria-label="Search this chat" value={find.q} onChange={(e) => runFind(e.target.value)} />
          {find.hits ? (
            <ul className="cv-hits">
              {find.hits.length === 0 ? <li className="when">Nothing found.</li> : null}
              {find.hits.map((h) => (
                <li key={h.id}><button type="button" onClick={() => { setFind({ open: false, q: "", hits: null }); jump(h.id); }}><b translate="no">{h.name}</b><span translate="no">{snippet(h.body)}</span><small>{dayLabel(h.created_at, nowIso)} {timeET(h.created_at)}</small></button></li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {shownPin ? (
        <button type="button" className="cv-pinbar" onClick={() => { jump(shownPin.id); setPinAt((i) => i + 1); }}>
          <span aria-hidden="true">📌</span><span className="cv-pin-txt"><b>{pinned.length > 1 ? `Pinned message ${(pinAt % pinned.length) + 1} of ${pinned.length}` : "Pinned message"}</b><span translate="no">{snippet(shownPin.image_url && shownPin.body === "GIF" ? "GIF" : shownPin.audio_url ? "Voice note" : shownPin.body)}</span></span>
        </button>
      ) : null}
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
                <div className="cv-bubble" onContextMenu={(e) => { e.preventDefault(); setMenu({ x: Math.min(e.clientX, window.innerWidth - 270), y: Math.min(e.clientY, window.innerHeight - 330), m }); }}>
                  {!m.mine && first ? <PersonLink id={m.author.id} name={m.author.name} className="cv-name"><strong>{m.author.name}</strong>{m.author.is_admin ? <small className="admin-tag">Admin</small> : null}</PersonLink> : null}
                  {m.replyTo ? (
                    <button type="button" className="cv-quote" onClick={() => jump(m.replyTo!.id)}><b translate="no">{m.replyTo.name}</b><span translate="no">{snippet(m.replyTo.body)}</span></button>
                  ) : null}
                  {m.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="cv-gif" src={m.image_url} alt="GIF" loading="lazy" onLoad={() => { if (stick.current && box.current) box.current.scrollTop = box.current.scrollHeight; }} />
                  ) : null}
                  {m.audio_url ? <VoiceNote src={m.audio_url} secs={m.audio_secs} /> : null}
                  {(m.image_url && m.body === "GIF") || (m.audio_url && m.body === "Voice note") ? null : <p className="cv-text"><UserText text={m.body} /></p>}
                  <span className="cv-meta">{m.pinned ? <span className="cv-pinmark" aria-label="Pinned">📌</span> : null}{m.edited_at ? <span className="cv-edited">edited</span> : null}<time dateTime={m.edited_at ?? m.created_at}>{timeET(m.edited_at ?? m.created_at)}</time>{m.mine && !m.legacy ? <span className={"cv-tick" + (m.readers?.length ? " seen" : "")} aria-label={m.readers?.length ? "Seen" : "Sent"}>{m.readers?.length ? "✓✓" : "✓"}</span> : null}</span>
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
          {editing ? <div className="cv-replying"><span><b>Editing message</b> <span translate="no">{snippet(editing.body)}</span></span><button type="button" className="linkbtn" onClick={() => { setEditing(null); setText(""); }} aria-label="Cancel edit">✕</button></div> : null}
          {replyTo ? <div className="cv-replying"><span><b translate="no">{replyTo.author.name}</b> <span translate="no">{snippet(replyTo.body)}</span></span><button type="button" className="linkbtn" onClick={() => setReplyTo(null)} aria-label="Cancel reply">✕</button></div> : null}
          {tray === "emoji" ? <div className="dock-tray" role="group" aria-label="Emoji"><EmojiPicker onPick={addEmoji} /></div> : null}
          {tray === "gif" ? (
            <div className="dock-tray gif" role="group" aria-label="GIFs">
              <input type="search" placeholder="Search GIFs" value={gifQ} aria-label="Search GIFs" onChange={(e) => { setGifQ(e.target.value); void searchGifs(e.target.value); }} />
              {gifs && !gifs.enabled ? <p className="dock-empty">GIF search is not switched on yet.</p> : null}
              <div className="dock-gifs">
                {(gifs?.results ?? []).map((g) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <button key={g.id} type="button" onClick={() => send(g.url)}><img src={g.preview} alt="" loading="lazy" /></button>
                ))}
              </div>
              <small className="when">Powered by GIPHY</small>
            </div>
          ) : null}
          <div className="cv-input">
            <button type="button" className={"dock-tool gifbtn" + (tray === "gif" ? " on" : "")} aria-label="Send a GIF" title="Send a GIF" aria-expanded={tray === "gif"} onClick={() => { const n = tray === "gif" ? null : "gif"; setTray(n); if (n && !gifs) void searchGifs(""); }}>GIF</button>
            <button type="button" className={"dock-tool" + (tray === "emoji" ? " on" : "")} aria-label="Emoji" title="Emoji" aria-expanded={tray === "emoji"} onClick={() => setTray(tray === "emoji" ? null : "emoji")}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8.5 14a4.2 4.2 0 0 0 7 0M9 9.5h.01M15 9.5h.01" /></svg>
            </button>
            <VoiceRecorder disabled={pending || !!editing} onSend={(url, secs) => send(null, { url, secs })} />
            <textarea ref={area} rows={1} maxLength={4000} value={text} placeholder={placeholder} aria-label="Write a message"
              onChange={(e) => { setText(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(160, e.target.scrollHeight) + "px"; }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
            <button type="button" className="btn primary" disabled={pending || !text.trim()} onClick={() => send()} aria-label="Send">{pending ? "…" : "Send"}</button>
          </div>
          {error ? <p className="err" role="alert" style={{ minHeight: 0, margin: "6px 0 0" }}>{error}</p> : null}
        </div>
      ) : <p className="when" style={{ margin: "10px 4px 0" }}>{readOnlyText ?? "Only admins can post here."}</p>}
      {menu ? (
        <div className="mute-menu cv-menu" role="menu" style={{ left: menu.x, top: menu.y }} onMouseDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
          {canPost ? <button type="button" role="menuitem" onClick={() => { setReplyTo(menu.m); setMenu(null); area.current?.focus(); }}>Reply</button> : null}
          {menu.m.mine && !menu.m.legacy && !menu.m.image_url && !menu.m.audio_url ? <button type="button" role="menuitem" onClick={() => { const m = menu.m; setMenu(null); setReplyTo(null); setEditing(m); setText(m.body); window.setTimeout(() => area.current?.focus(), 0); }}>Edit</button> : null}
          {canPin && kind === "chat" && !menu.m.legacy ? <button type="button" role="menuitem" onClick={() => { const m = menu.m; setMenu(null); start(async () => { const r = await pinPost(m.id, slug, !m.pinned); if (!r.ok) setError(r.error ?? "That did not work."); else router.refresh(); }); }}>{menu.m.pinned ? "Unpin" : "Pin to top"}</button> : null}
          {menu.m.canDelete ? <button type="button" role="menuitem" onClick={() => { const m = menu.m; setMenu(null); remove(m); }}>Delete</button> : null}
          {menu.m.mine && !menu.m.legacy ? (
            <>
              <hr />
              <p className="cv-seen-h">{menu.m.readers?.length ? `Seen by ${menu.m.readers.length}` : "Not seen yet"}</p>
              <ul className="cv-seen">
                {(menu.m.readers ?? []).slice(0, 40).map((r) => (
                  <li key={r.id}>
                    <PersonLink id={r.id} name={r.name}><Avatar url={r.avatar_url} initials={r.name.charAt(0).toUpperCase()} size={28} /></PersonLink>
                    <span><b translate="no">{r.name}</b><small>{dayLabel(r.at, nowIso)} {timeET(r.at)}</small></span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
