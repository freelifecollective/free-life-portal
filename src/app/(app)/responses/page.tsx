import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { requireMember } from "@/lib/auth/guards";
import { authorsById } from "@/lib/chats/queries";

export const instant = false;
export const metadata = { title: "Verbiage + Objections" };

type Row = { id: string; author_id: string; body: string; votes: number };

export default async function ResponsesPage() {
  const { session, supabase } = await requireMember();
  if (session.profile.role === "lead") redirect("/chats");
  if (!supabase) return <><PageHeading>Verbiage + Objections</PageHeading><p className="page-lede">This needs the database.</p></>;
  const { data } = await supabase.from("top_responses").select("id, author_id, body, votes").order("votes", { ascending: false });
  const rows = (data ?? []) as Row[];
  const authors = await authorsById(supabase, rows.map((r) => r.author_id));
  return (
    <>
      <PageHeading lede="The below are answers the community has voted for in the Verbiage/Objections chat as being quality responses. These are from other members in the community looking for help to respond to messages from their leads.">Verbiage + Objections</PageHeading>
      {rows.length === 0 ? (
        <section className="card-s" style={{ maxWidth: 560 }}>
          <p style={{ margin: 0 }}>Nothing has reached 15 votes yet. Add and vote on answers in <Link href="/chats/verbiage-objections">Verbiage/Objections chat</Link>.</p>
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
