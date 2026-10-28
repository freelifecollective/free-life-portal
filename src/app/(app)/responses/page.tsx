import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { requireMember } from "@/lib/auth/guards";
import { authorsById } from "@/lib/chats/queries";

export const instant = false;
export const metadata = { title: "How to respond to leads" };

type Row = { id: string; author_id: string; body: string; votes: number };

export default async function ResponsesPage() {
  const { supabase } = await requireMember();
  if (!supabase) return <><PageHeading>How to respond to leads</PageHeading><p className="page-lede">This needs the database.</p></>;
  const { data } = await supabase.from("top_responses").select("id, author_id, body, votes").order("votes", { ascending: false });
  const rows = (data ?? []) as Row[];
  const authors = await authorsById(supabase, rows.map((r) => r.author_id));
  return (
    <>
      <PageHeading lede="Answers the community has voted for. An answer appears here once it has more than 15 votes in the Verbiage/Objections chat.">How to respond to leads</PageHeading>
      {rows.length === 0 ? (
        <section className="card-s" style={{ maxWidth: 560 }}>
          <p style={{ margin: 0 }}>Nothing has reached 15 votes yet. Add and vote on answers in <Link href="/chats/verbiage-objections">Verbiage/Objections</Link>.</p>
        </section>
      ) : (
        <div className="chat-main">
          {rows.map((r) => (
            <article key={r.id} className="post card-s">
              <p className="post-body">{r.body}</p>
              <p className="when">{r.votes} votes · suggested by {authors.get(r.author_id)?.name ?? "a member"}</p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
