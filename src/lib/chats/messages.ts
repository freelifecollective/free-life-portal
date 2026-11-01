import type { Author, PostView } from "./types";

/** One message in a conversation, from a community chat or a private group. */
export type Msg = {
  id: string;
  author: Author;
  body: string;
  created_at: string;
  mine: boolean;
  canDelete: boolean;
  /** an older reply from before chats became conversations: it can be read and deleted but not reacted to */
  legacy?: boolean;
  audio_url?: string | null;
  audio_secs?: number | null;
  edited_at?: string | null;
  pinned?: boolean;
  /** a GIF sent with (or instead of) the text */
  image_url?: string | null;
  /** people who have seen my message, and when (only filled in for my own messages) */
  readers?: { id: string; name: string; avatar_url: string | null; at: string }[];
  replyTo: { id: string; name: string; body: string } | null;
  reactions?: PostView["reactions"];
  myReaction?: string | null;
};

const ZONE = "America/New_York";
export const timeET = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: ZONE, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
export const dayLabel = (iso: string, nowIso: string) => {
  const k = dayKey(iso);
  if (k === dayKey(nowIso)) return "Today";
  if (k === dayKey(new Date(new Date(nowIso).getTime() - 86400000).toISOString())) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", { timeZone: ZONE, weekday: "long", month: "long", day: "numeric" }).format(new Date(iso));
};

export type Row = { kind: "day"; key: string; label: string } | { kind: "msg"; m: Msg; first: boolean; last: boolean };

/** Puts day dividers in, and groups messages from the same person within five minutes so only the first shows a name. */
export function toRows(messages: Msg[], nowIso: string): Row[] {
  const out: Row[] = [];
  let prev: Msg | null = null;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
    if (newDay) out.push({ kind: "day", key: dayKey(m.created_at), label: dayLabel(m.created_at, nowIso) });
    const near = (a: Msg, b: Msg) => a.author.id === b.author.id && Math.abs(new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) < 5 * 60000 && dayKey(a.created_at) === dayKey(b.created_at);
    const first = !prev || newDay || !near(prev, m) || !!m.replyTo;
    const next = messages[i + 1];
    const last = !next || !near(m, next) || !!next.replyTo || dayKey(next.created_at) !== dayKey(m.created_at);
    out.push({ kind: "msg", m, first, last });
    prev = m;
  }
  return out;
}
