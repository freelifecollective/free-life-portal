import { redirect } from "next/navigation";
import { ApplyForm } from "@/components/closers/ApplyForm";
import { CloserCard } from "@/components/closers/CloserCard";
import { PageHeading } from "@/components/PageHeading";
import { requireMember } from "@/lib/auth/guards";
import type { Application, CloserCardData } from "@/lib/closers/types";

export const instant = false;
export const metadata = { title: "Call Closers for Hire" };

export default async function CallClosersPage() {
  const { session, supabase } = await requireMember();
  if (session.profile.role === "lead") redirect("/");
  if (!supabase) return <><PageHeading>Call Closers for Hire</PageHeading><p className="page-lede">This needs the database.</p></>;
  const [{ data: list }, { data: apps }, { data: me }] = await Promise.all([
    supabase.rpc("call_closers_directory"),
    supabase.from("closer_applications").select("id, member_id, status, experience, calls_taken, availability, pitch, price_per_call_cents, price_per_sale, review_note, created_at").eq("member_id", session.user.id).order("created_at", { ascending: false }).limit(1),
    supabase.from("profiles").select("call_closer").eq("id", session.user.id).maybeSingle(),
  ]);
  const closers = (list ?? []) as CloserCardData[];
  const mine = ((apps ?? []) as Application[])[0] ?? null;
  const isCloser = !!(me as { call_closer: boolean } | null)?.call_closer;
  return (
    <>
      <PageHeading lede="Hire an FLC call closer to take the sales call with your lead. Message them, agree a price, then add the call on Home so they can be reviewed.">Call Closers for Hire</PageHeading>
      <div className="stack" style={{ maxWidth: 820 }}>
        {closers.length === 0 ? <section className="card-s"><p style={{ margin: 0 }}>No call closers are listed yet.</p></section> : (
          <div className="closer-grid">{closers.map((c) => <CloserCard key={c.id} c={c} me={session.user.id} />)}</div>
        )}
        <ApplyForm mine={mine} isCloser={isCloser} />
      </div>
    </>
  );
}
