import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { ChatList } from "@/components/chats/ChatList";
import { requireMember } from "@/lib/auth/guards";
import { authorsById } from "@/lib/chats/queries";
import { loadSidebar } from "@/lib/chats/sidebar";
import { timeET } from "@/lib/chats/messages";

export const instant = false;
export const metadata = { title: "Search all chats" };

const likeSafe = (q: string) => q.replace(/[\\%_]/g, (c) => "\\" + c);
const day = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));

export default async function SearchChats(props: PageProps<"/chats/search">) {
  const sp = await props.searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 80);
  const { session, supabase } = await requireMember();
  if (!supabase) notFound();
  const side = await loadSidebar(supabase);
  const term = `%${likeSafe(q)}%`;
  const [{ data: posts }, { data: msgs }] = q.length >= 2
    ? await Promise.all([
        supabase.from("chat_posts").select("id, chat_id, author_id, body, created_at").ilike("body", term).order("created_at", { ascending: false }).limit(40),
        side.groups.length ? supabase.from("group_messages").select("id, group_id, author_id, body, created_at").ilike("body", term).order("created_at", { ascending: false }).limit(40) : Promise.resolve({ data: [] }),
      ])
    : [{ data: [] }, { data: [] }];
  const chats = new Map(side.sections.flatMap((s) => s.chats).map((c) => [c.id, c]));
  const groups = new Map(side.groups.map((g) => [g.id, g]));
  const p = (posts ?? []) as { id: string; chat_id: string; author_id: string; body: string; created_at: string }[];
  const g = (msgs ?? []) as { id: string; group_id: string; author_id: string | null; body: string; created_at: string }[];
  const authors = await authorsById(supabase, [...p.map((x) => x.author_id), ...g.map((x) => x.author_id).filter((x): x is string => !!x)]);
  const hits = [
    ...p.flatMap((x) => { const c = chats.get(x.chat_id); return c ? [{ id: x.id, href: `/chats/${c.slug}?limit=300&jump=${x.id}`, where: c.name, who: authors.get(x.author_id)?.name ?? "Member", body: x.body, at: x.created_at }] : []; }),
    ...g.flatMap((x) => { const gr = groups.get(x.group_id); return gr ? [{ id: x.id, href: `/groups/${x.group_id}?limit=300&jump=${x.id}`, where: gr.name, who: (x.author_id && authors.get(x.author_id)?.name) || "Member", body: x.body, at: x.created_at }] : []; }),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 60);
  return (
    <div className="chats">
      <div className="chats-head"><PageHeading lede={q ? undefined : "Type at least two letters in the box on the left."}>Search all chats</PageHeading></div>
      <ChatList sections={side.sections} current="" role={session.profile.role} muted={side.muted} unread={side.unread} groups={side.groups} />
      <div className="chat-main" style={{ display: "grid", gap: 8, alignContent: "start" }}>
        {q.length >= 2 ? <p className="when" style={{ margin: 0 }}>{hits.length ? `Results for “${q}”` : `Nothing found for “${q}”.`}</p> : null}
        {hits.map((h) => (
          <Link key={h.id} href={h.href} className="sr-hit">
            <b>{h.where}</b>
            <span translate="no"><strong>{h.who}:</strong> {h.body.length > 220 ? h.body.slice(0, 218) + "…" : h.body}</span>
            <small>{day(h.at)} {timeET(h.at)}</small>
          </Link>
        ))}
      </div>
    </div>
  );
}
