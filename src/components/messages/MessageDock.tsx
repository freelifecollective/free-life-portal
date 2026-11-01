"use client";

import { PersonTap } from "@/components/people/ProfilePopup";
import { UserText } from "@/components/UserText";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Avatar } from "@/components/Avatar";
import { AttachButton } from "@/components/attach/AttachButton";
import { AttachmentView } from "@/components/attach/AttachmentView";
import { ForwardDialog } from "@/components/conversation/ForwardDialog";
import type { Attach } from "@/lib/chats/attach";
import { VoiceNote } from "@/components/voice/VoiceNote";
import { VoiceRecorder } from "@/components/voice/VoiceRecorder";
import { DmPicture } from "@/components/messages/DmPicture";
import { EmojiPicker } from "@/components/chats/EmojiPicker";
import { createClient } from "@/lib/supabase/client";

type P = { id: string; first_name: string | null; last_name: string | null; username: string | null; avatar_url: string | null };
type Dm = { id: string; sender_id: string; recipient_id: string; body: string; created_at: string; read_at: string | null; image_url: string | null; edited_at?: string | null; audio_url?: string | null; audio_secs?: number | null; attach_url?: string | null; attach_name?: string | null; attach_type?: string | null; attach_size?: number | null; forwarded_from?: string | null };
type Convo = { other: P; last: Dm; unread: number };
type Win = { id: string; min: boolean };

const COLS = "id, sender_id, recipient_id, body, created_at, read_at, image_url, edited_at, audio_url, audio_secs, attach_url, attach_name, attach_type, attach_size, forwarded_from";
const COLS_OLD = "id, sender_id, recipient_id, body, created_at, read_at, image_url";   /* before the edit update has been run */
const CARD = "id, first_name, last_name, username, avatar_url";
const MAX_WINDOWS = 3;
const name = (p: Pick<P, "first_name" | "last_name">) => [p.first_name, p.last_name].filter(Boolean).join(" ") || "Member";
/** Opens a chat window from anywhere on the page (for example the Message button on a profile). */
export function openDockChat(id: string) {
  const cur = parse(read()).filter((w) => w.id !== id);
  save([{ id, min: false }, ...cur].slice(0, MAX_WINDOWS));
}
const initials = (p: P) => ((p.first_name ?? "").charAt(0) + (p.last_name ?? "").charAt(0)).toUpperCase() || "?";

/* which chat windows are open is remembered on this device, so they are still there on the next page */
const KEY = "flc_dock";
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => { listeners.add(cb); window.addEventListener("storage", cb); return () => { listeners.delete(cb); window.removeEventListener("storage", cb); }; };
const read = () => { try { return localStorage.getItem(KEY) ?? "[]"; } catch { return "[]"; } };
const parse = (s: string): Win[] => { try { const v = JSON.parse(s); return Array.isArray(v) ? v.filter((w) => w && typeof w.id === "string").slice(0, MAX_WINDOWS) : []; } catch { return []; } };
function save(list: Win[]) { try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_WINDOWS))); } catch { /* still works this visit */ } listeners.forEach((l) => l()); }

function when(iso: string): string {
  const d = new Date(iso), now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * The messages icon in the top bar, working like Facebook: the icon opens a list of conversations, and choosing one opens a small
 * chat window at the bottom of the screen. Up to three windows sit side by side, and each can be minimised or closed.
 */
export function MessageDock({ me, unread }: { me: string; unread: number }) {
  const [supabase] = useState(() => createClient());
  const saved = useSyncExternalStore(subscribe, read, () => "[]");
  const wins = parse(saved);
  const [panel, setPanel] = useState(false);
  const [convos, setConvos] = useState<Convo[] | null>(null);
  const [people, setPeople] = useState<Record<string, P>>({});
  const [tick, setTick] = useState(0);
  const [mode, setMode] = useState<"list" | "new">("list");
  const [everyone, setEveryone] = useState<P[] | null>(null);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const first = await supabase.from("direct_messages").select(COLS).order("created_at", { ascending: false }).limit(300);
    const res = first.error ? await supabase.from("direct_messages").select(COLS_OLD).order("created_at", { ascending: false }).limit(300) : first;
    const rows = (res.data ?? []) as unknown as Dm[];
    const by = new Map<string, Dm[]>();
    for (const m of rows) { const o = m.sender_id === me ? m.recipient_id : m.sender_id; by.set(o, [...(by.get(o) ?? []), m]); }
    const ids = [...by.keys()];
    const { data: cards } = ids.length ? await supabase.from("profile_cards").select(CARD).in("id", ids) : { data: [] };
    const map = new Map(((cards ?? []) as P[]).map((c) => [c.id, c]));
    setPeople((cur) => ({ ...cur, ...Object.fromEntries(map) }));
    setConvos([...by.entries()].flatMap(([id, msgs]) => { const other = map.get(id); return other ? [{ other, last: msgs[0], unread: msgs.filter((m) => m.recipient_id === me && !m.read_at).length }] : []; }));
  }, [supabase, me]);

  /* first load, and again whenever anything in direct messages changes */
  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    let timer: number | undefined;
    const soon = () => { window.clearTimeout(timer); timer = window.setTimeout(() => { void load(); setTick((t) => t + 1); }, 300); };
    const ch = supabase.channel("dock-dm").on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, soon).subscribe();
    return () => { window.clearTimeout(first); window.clearTimeout(timer); void supabase.removeChannel(ch); };
  }, [supabase, load]);

  /* clicking away from the list closes it */
  useEffect(() => {
    if (!panel) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setPanel(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setPanel(false); };
    document.addEventListener("pointerdown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [panel]);

  const total = convos ? convos.reduce((n, c) => n + c.unread, 0) : unread;

  function openChat(p: P) {
    setPeople((cur) => ({ ...cur, [p.id]: p }));
    const rest = wins.filter((w) => w.id !== p.id);
    save([{ id: p.id, min: false }, ...rest].slice(0, MAX_WINDOWS));
    setPanel(false); setMode("list");
  }
  const update = (id: string, patch: Partial<Win>) => save(wins.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  const close = (id: string) => save(wins.filter((w) => w.id !== id));

  async function startNew() {
    setMode("new");
    if (!everyone) { const { data } = await supabase.rpc("messageable_people"); setEveryone(((data ?? []) as P[]).filter((p) => p.id !== me)); }
  }

  /* windows whose person we do not know yet (after a page load) */
  const missing = wins.map((w) => w.id).filter((id) => !people[id]).join(",");
  useEffect(() => {
    if (!missing) return;
    void supabase.from("profile_cards").select(CARD).in("id", missing.split(",")).then(({ data }) => {
      const list = (data ?? []) as P[];
      if (list.length) setPeople((cur) => ({ ...cur, ...Object.fromEntries(list.map((c) => [c.id, c])) }));
    });
  }, [missing, supabase]);

  return (
    <>
      <div className="dock-icon" ref={box}>
        <button type="button" className="hdr-btn" data-tour="messages" aria-haspopup="dialog" aria-expanded={panel}
          aria-label={total ? `Messages, ${total} unread` : "Messages"} onClick={() => { setPanel(!panel); setMode("list"); }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          {total ? <span className="badge bell-badge" aria-hidden="true">{total > 99 ? "99+" : total}</span> : null}
        </button>
        {panel ? (
          <div className="dock-panel" role="dialog" aria-label="Messages">
            <div className="dock-panel-head">
              <strong>{mode === "new" ? "New message" : "Messages"}</strong>
              {mode === "new" ? <button type="button" className="linkbtn" onClick={() => setMode("list")}>Back</button> : <button type="button" className="linkbtn" onClick={() => void startNew()}>New message</button>}
            </div>
            {mode === "new" ? (
              <div className="dock-new">
                <input type="search" autoFocus placeholder="Search for someone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search for someone" />
                <ul className="dock-list">
                  {(everyone ?? []).filter((p) => name(p).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 30).map((p) => (
                    <li key={p.id}><button type="button" onClick={() => openChat(p)}><PersonTap id={p.id} name={name(p)}><Avatar url={p.avatar_url} initials={initials(p)} size={40} /></PersonTap><span className="dock-who"><strong>{name(p)}</strong></span></button></li>
                  ))}
                  {everyone && everyone.length === 0 ? <li className="dock-empty">There is no one you can message yet.</li> : null}
                  {!everyone ? <li className="dock-empty">Loading…</li> : null}
                </ul>
              </div>
            ) : (
              <ul className="dock-list">
                {(convos ?? []).slice(0, 14).map((c) => (
                  <li key={c.other.id} className={c.unread ? "unread" : ""}>
                    <button type="button" onClick={() => openChat(c.other)}>
                      <PersonTap id={c.other.id} name={name(c.other)}><Avatar url={c.other.avatar_url} initials={initials(c.other)} size={44} /></PersonTap>
                      <span className="dock-who"><strong>{name(c.other)}</strong><span>{c.last.sender_id === me ? "You: " : ""}{c.last.body || (c.last.audio_url ? "🎤 Voice note" : c.last.attach_url ? "📎 File" : "📷 Picture")}</span></span>
                      <span className="dock-meta">{when(c.last.created_at)}{c.unread ? <i aria-label={`${c.unread} unread`} /> : null}</span>
                    </button>
                  </li>
                ))}
                {convos && convos.length === 0 ? <li className="dock-empty">No messages yet. Choose <strong>New message</strong> to start a conversation.</li> : null}
                {!convos ? <li className="dock-empty">Loading…</li> : null}
              </ul>
            )}
            <Link className="dock-all" href="/messages" onClick={() => setPanel(false)}>See all in Messages</Link>
          </div>
        ) : null}
      </div>

      <div className="dock-windows" aria-label="Open conversations">
        {wins.map((w) => {
          const person = people[w.id];
          return person ? <ChatWindow key={w.id} me={me} other={person} min={w.min} tick={tick} onMin={() => update(w.id, { min: !w.min })} onClose={() => close(w.id)} onCounts={() => { void load(); }} /> : null;
        })}
      </div>
    </>
  );
}

function ChatWindow({ me, other, min, tick, onMin, onClose, onCounts }: { me: string; other: P; min: boolean; tick: number; onMin: () => void; onClose: () => void; onCounts: () => void }) {
  const [supabase] = useState(() => createClient());
  const [msgs, setMsgs] = useState<Dm[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const [tray, setTray] = useState<"emoji" | "gif" | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [ctx, setCtx] = useState<{ x: number; y: number; m: Dm } | null>(null);
  const [fwd, setFwd] = useState<Dm | null>(null);
  const [editing, setEditing] = useState<Dm | null>(null);
  const [gifQ, setGifQ] = useState("");
  const [gifs, setGifs] = useState<{ enabled: boolean; results: { id: string; url: string; preview: string }[] } | null>(null);

  const fetchThread = useCallback(async () => {
    const thread = (cols: string) => supabase.from("direct_messages").select(cols)
      .or(`and(sender_id.eq.${me},recipient_id.eq.${other.id}),and(sender_id.eq.${other.id},recipient_id.eq.${me})`)
      .order("created_at", { ascending: false }).limit(80);
    const firstT = await thread(COLS);
    const res = firstT.error ? await thread(COLS_OLD) : firstT;
    const list = ((res.data ?? []) as unknown as Dm[]).reverse();
    setMsgs(list);
    /* an open window means the messages in it are being read */
    if (!min && list.some((m) => m.recipient_id === me && !m.read_at)) { await supabase.rpc("mark_conversation_read", { p_other: other.id }); onCounts(); }
  }, [supabase, me, other.id, min, onCounts]);

  useEffect(() => { const t = window.setTimeout(() => void fetchThread(), 0); return () => window.clearTimeout(t); }, [fetchThread, tick]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs.length, min]);

  async function send(image?: string) {
    const body = image ? "" : text.trim();
    if ((!body && !image) || sending) return;
    if (editing) {
      const target = editing;
      setSending(true); setError("");
      const { data, error: e } = await supabase.rpc("edit_direct_message", { p_id: target.id, p_body: body });
      setSending(false);
      if (e || !data) { setError("We could not save that change."); return; }
      setEditing(null); setText("");
      await fetchThread();
      return;
    }
    setSending(true); setError(""); setTray(null);
    const temp: Dm = { id: "tmp-" + crypto.randomUUID(), sender_id: me, recipient_id: other.id, body, created_at: new Date().toISOString(), read_at: null, image_url: image ?? null };
    setMsgs((cur) => [...cur, temp]); if (!image) setText("");
    const { error: e } = await supabase.from("direct_messages").insert({ sender_id: me, recipient_id: other.id, body, image_url: image ?? null });
    setSending(false);
    if (e) { setMsgs((cur) => cur.filter((m) => m.id !== temp.id)); if (!image) setText(body); setError(e.code === "42501" ? "You cannot message this person." : "We could not send that. Please try again."); }
    else { await fetchThread(); onCounts(); }
  }

  async function sendVoice(url: string, secs: number) {
    setError("");
    const { error: e } = await supabase.from("direct_messages").insert({ sender_id: me, recipient_id: other.id, body: "", audio_url: url, audio_secs: secs });
    if (e) { setError(e.code === "42501" ? "You cannot message this person." : "We could not send that. Please try again."); return; }
    await fetchThread(); onCounts();
  }

  async function sendAttach(a: Attach) {
    setError("");
    const { error: e } = await supabase.from("direct_messages").insert({ sender_id: me, recipient_id: other.id, body: "", attach_url: a.url, attach_name: a.name, attach_type: a.type, attach_size: a.size });
    if (e) { setError(e.code === "42501" ? "You cannot message this person." : "We could not send that. Please try again."); return; }
    await fetchThread(); onCounts();
  }

  async function sendPicture(f: File | undefined) {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(f.type)) { setError("Please choose a JPG, PNG, WebP or GIF picture."); return; }
    if (f.size > 5 * 1024 * 1024) { setError("That picture is over 5 MB. Please choose a smaller one."); return; }
    setError(""); setSending(true);
    const ext = f.type === "image/jpeg" ? "jpg" : f.type.split("/")[1];
    const path = `${me}/${crypto.randomUUID()}.${ext}`;
    const { error: up } = await supabase.storage.from("dm-pictures").upload(path, f, { contentType: f.type });
    setSending(false);
    if (up) { setError("We could not upload that picture. Please try again."); return; }
    await send(supabase.storage.from("dm-pictures").getPublicUrl(path).data.publicUrl);
  }

  async function remove(m: Dm) {
    setAsking(null);
    setMsgs((cur) => cur.filter((x) => x.id !== m.id));
    const { error: e } = await supabase.from("direct_messages").delete().eq("id", m.id).eq("sender_id", me);
    if (e) { setError("We could not remove that message."); await fetchThread(); return; }
    const mark = "/dm-pictures/";
    if (m.image_url?.includes(mark)) void supabase.storage.from("dm-pictures").remove([m.image_url.split(mark)[1]]);
    onCounts();
  }

  function addEmoji(em: string) {
    const el = field.current;
    const at = el?.selectionStart ?? text.length;
    const end2 = el?.selectionEnd ?? text.length;
    setText((t) => (t.slice(0, at) + em + t.slice(end2)).slice(0, 4000));
    window.setTimeout(() => { el?.focus(); el?.setSelectionRange(at + em.length, at + em.length); }, 0);
  }

  async function searchGifs(q: string) {
    try {
      const res = await fetch(`/api/gifs?q=${encodeURIComponent(q)}`);
      setGifs((await res.json()) as { enabled: boolean; results: { id: string; url: string; preview: string }[] });
    } catch { setGifs({ enabled: true, results: [] }); }
  }
  function openGifs() {
    const next = tray === "gif" ? null : "gif";
    setTray(next);
    if (next && !gifs) void searchGifs("");
  }

  return (
    <section className={"dock-win" + (min ? " min" : "")} aria-label={`Chat with ${name(other)}`}>
      <header className="dock-win-head">
        <button type="button" className="dock-win-title" onClick={onMin} aria-expanded={!min}>
          <PersonTap id={other.id} name={name(other)}><Avatar url={other.avatar_url} initials={initials(other)} size={40} /></PersonTap>
          <span className="dock-win-who"><strong>{name(other)}</strong>{other.username ? <small>@{other.username}</small> : null}</span>
        </button>
        <span className="dock-win-tools">
          {other.username ? <Link href={`/messages/${other.username}`} className="dock-x" aria-label="Open in the Messages page" title="Open in the Messages page"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg></Link> : null}
          <button type="button" className="dock-x" aria-label={min ? "Open chat" : "Minimise chat"} onClick={onMin}>{min ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="m6 15 6-6 6 6" /></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 12h12" /></svg>}</button>
          <button type="button" className="dock-x" aria-label="Close chat" onClick={onClose}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
        </span>
      </header>
      {!min ? (
        <>
          <div className="dock-thread" aria-live="polite">
            {msgs.length === 0 ? <p className="dock-empty">Say hello to {other.first_name ?? "them"}.</p> : null}
            {msgs.map((m, i) => {
              const mine = m.sender_id === me;
              const gap = i === 0 || new Date(m.created_at).getTime() - new Date(msgs[i - 1].created_at).getTime() > 30 * 60_000;
              return (
                <div key={m.id} className="dock-row">
                  {gap ? <time className="dock-time" dateTime={m.created_at}>{new Date(m.created_at).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}</time> : null}
                  <div className={"dock-line " + (mine ? "mine" : "theirs")} onContextMenu={(e) => { if (m.id.startsWith("tmp-")) return; e.preventDefault(); setCtx({ x: Math.min(e.clientX, window.innerWidth - 180), y: Math.min(e.clientY, window.innerHeight - 80), m }); }}>
                    {mine && !m.id.startsWith("tmp-") ? (
                      asking === m.id ? (
                        <span className="dock-ask">Remove? <button type="button" onClick={() => void remove(m)}>Yes</button><button type="button" onClick={() => setAsking(null)}>No</button></span>
                      ) : (
                        <>
                        {!m.image_url && !m.audio_url && !m.attach_url ? <button type="button" className="dock-del" aria-label="Edit this message" title="Edit this message" onClick={() => { setEditing(m); setText(m.body); window.setTimeout(() => field.current?.focus(), 0); }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
                        </button> : null}
                        <button type="button" className="dock-del" aria-label="Remove this message" title="Remove this message" onClick={() => setAsking(m.id)}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></svg>
                        </button>
                        </>
                      )
                    ) : null}
                    <div className={"dock-msg " + (mine ? "mine" : "theirs") + (m.image_url ? " pic" : "")}>
                      {m.forwarded_from ? <span className="fwd-from">Forwarded from <b translate="no">{m.forwarded_from}</b></span> : null}
                      {m.attach_url ? <AttachmentView url={m.attach_url} name={m.attach_name ?? "File"} type={m.attach_type ?? "application/octet-stream"} size={m.attach_size} /> : null}
                      {m.audio_url ? <VoiceNote src={m.audio_url} secs={m.audio_secs} /> : null}
                      {m.image_url ? <DmPicture src={m.image_url} onLoad={() => end.current?.scrollIntoView({ block: "end" })} /> : null}
                      {m.body ? <p><UserText text={m.body} />{m.edited_at ? <i className="dock-edited"> edited</i> : null}</p> : null}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={end} />
          </div>
          {error ? <p className="err" role="alert" style={{ margin: "0 12px 4px" }}>{error}</p> : null}
          {ctx ? <div className="mute-menu" role="menu" style={{ left: ctx.x, top: ctx.y, zIndex: 300 }} onMouseLeave={() => setCtx(null)}><button type="button" role="menuitem" onClick={() => { setFwd(ctx.m); setCtx(null); }}>Forward</button></div> : null}
          {fwd ? <ForwardDialog source={{ kind: "dm", id: fwd.id }} me={me} onClose={() => setFwd(null)} /> : null}
          {tray === "emoji" ? (
            <div className="dock-tray" role="group" aria-label="Emoji"><EmojiPicker onPick={addEmoji} /></div>
          ) : null}
          {tray === "gif" ? (
            <div className="dock-tray gif" role="group" aria-label="GIFs">
              <input type="search" placeholder="Search GIFs" value={gifQ} aria-label="Search GIFs" onChange={(e) => { setGifQ(e.target.value); void searchGifs(e.target.value); }} />
              {gifs && !gifs.enabled ? <p className="dock-empty">GIF search is not switched on yet.</p> : null}
              <div className="dock-gifs">
                {(gifs?.results ?? []).map((g) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <button key={g.id} type="button" onClick={() => void send(g.url)}><img src={g.preview} alt="" loading="lazy" /></button>
                ))}
              </div>
              <small className="when">Powered by GIPHY</small>
            </div>
          ) : null}
          {editing ? <p className="dock-editing">Editing message <button type="button" className="linkbtn" onClick={() => { setEditing(null); setText(""); }}>Cancel</button></p> : null}
          <form className="dock-compose" onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => { void sendPicture(e.target.files?.[0]); e.target.value = ""; }} />
            <button type="button" className="dock-tool" aria-label="Send a picture" title="Send a picture" disabled={sending} onClick={() => file.current?.click()}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="m21 16-5-5-9 9" /></svg>
            </button>
            <button type="button" className={"dock-tool gifbtn" + (tray === "gif" ? " on" : "")} aria-label="Send a GIF" title="Send a GIF" aria-expanded={tray === "gif"} onClick={openGifs}>GIF</button>
            <button type="button" className={"dock-tool" + (tray === "emoji" ? " on" : "")} aria-label="Emoji" title="Emoji" aria-expanded={tray === "emoji"} onClick={() => setTray(tray === "emoji" ? null : "emoji")}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8.5 14a4.2 4.2 0 0 0 7 0M9 9.5h.01M15 9.5h.01" /></svg>
            </button>
            <AttachButton disabled={sending || !!editing} onPick={sendAttach} />
            <VoiceRecorder disabled={sending || !!editing} onSend={sendVoice} />
            <textarea ref={field} rows={1} value={text} maxLength={4000} placeholder="Aa" aria-label={`Message ${name(other)}`} autoFocus
              onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
            <button type="submit" className="dock-send" disabled={!text.trim() || sending} aria-label="Send"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12 2-12 2z" /></svg></button>
          </form>
        </>
      ) : null}
    </section>
  );
}
