"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Avatar } from "@/components/Avatar";
import { createClient } from "@/lib/supabase/client";

type P = { id: string; first_name: string | null; last_name: string | null; username: string | null; avatar_url: string | null };
type Dm = { id: string; sender_id: string; recipient_id: string; body: string; created_at: string; read_at: string | null };
type Convo = { other: P; last: Dm; unread: number };
type Win = { id: string; min: boolean };

const COLS = "id, sender_id, recipient_id, body, created_at, read_at";
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
    const { data } = await supabase.from("direct_messages").select(COLS).order("created_at", { ascending: false }).limit(300);
    const rows = (data ?? []) as Dm[];
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
                    <li key={p.id}><button type="button" onClick={() => openChat(p)}><Avatar url={p.avatar_url} initials={initials(p)} size={40} /><span className="dock-who"><strong>{name(p)}</strong></span></button></li>
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
                      <Avatar url={c.other.avatar_url} initials={initials(c.other)} size={44} />
                      <span className="dock-who"><strong>{name(c.other)}</strong><span>{c.last.sender_id === me ? "You: " : ""}{c.last.body}</span></span>
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

  const fetchThread = useCallback(async () => {
    const { data } = await supabase.from("direct_messages").select(COLS)
      .or(`and(sender_id.eq.${me},recipient_id.eq.${other.id}),and(sender_id.eq.${other.id},recipient_id.eq.${me})`)
      .order("created_at", { ascending: false }).limit(80);
    const list = ((data ?? []) as Dm[]).reverse();
    setMsgs(list);
    /* an open window means the messages in it are being read */
    if (!min && list.some((m) => m.recipient_id === me && !m.read_at)) { await supabase.rpc("mark_conversation_read", { p_other: other.id }); onCounts(); }
  }, [supabase, me, other.id, min, onCounts]);

  useEffect(() => { const t = window.setTimeout(() => void fetchThread(), 0); return () => window.clearTimeout(t); }, [fetchThread, tick]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs.length, min]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true); setError("");
    const temp: Dm = { id: "tmp-" + Date.now(), sender_id: me, recipient_id: other.id, body, created_at: new Date().toISOString(), read_at: null };
    setMsgs((cur) => [...cur, temp]); setText("");
    const { error: e } = await supabase.from("direct_messages").insert({ sender_id: me, recipient_id: other.id, body });
    setSending(false);
    if (e) { setMsgs((cur) => cur.filter((m) => m.id !== temp.id)); setText(body); setError(e.code === "42501" ? "You cannot message this person." : "We could not send that. Please try again."); }
    else { await fetchThread(); onCounts(); }
  }

  return (
    <section className={"dock-win" + (min ? " min" : "")} aria-label={`Chat with ${name(other)}`}>
      <header className="dock-win-head">
        <button type="button" className="dock-win-title" onClick={onMin} aria-expanded={!min}>
          <Avatar url={other.avatar_url} initials={initials(other)} size={32} />
          <strong>{name(other)}</strong>
        </button>
        <span className="dock-win-tools">
          {other.username ? <Link href={`/messages/${other.username}`} className="dock-x" aria-label="Open in the Messages page" title="Open in the Messages page">↗</Link> : null}
          <button type="button" className="dock-x" aria-label={min ? "Open chat" : "Minimise chat"} onClick={onMin}>{min ? "▴" : "–"}</button>
          <button type="button" className="dock-x" aria-label="Close chat" onClick={onClose}>×</button>
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
                  <p className={"dock-msg " + (mine ? "mine" : "theirs")}>{m.body}</p>
                </div>
              );
            })}
            <div ref={end} />
          </div>
          {error ? <p className="err" role="alert" style={{ margin: "0 12px 4px" }}>{error}</p> : null}
          <form className="dock-compose" onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <textarea rows={1} value={text} maxLength={4000} placeholder="Write a message" aria-label={`Message ${name(other)}`} autoFocus
              onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
            <button type="submit" className="dock-send" disabled={!text.trim() || sending} aria-label="Send">➤</button>
          </form>
        </>
      ) : null}
    </section>
  );
}
