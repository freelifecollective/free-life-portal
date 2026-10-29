import { redirect } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { BuddyHome, type MatchCard } from "@/components/buddy/BuddyHome";
import { BuddyQuestionnaire } from "@/components/buddy/BuddyQuestionnaire";
import { requireMember } from "@/lib/auth/guards";
import { RANKS } from "@/lib/buddy/questions";
import { cleanAnswers, isComplete } from "@/lib/buddy/validate";

export const instant = false;
export const metadata = { title: "Accountability Buddy" };

export default async function BuddyPage(props: PageProps<"/buddy">) {
  const sp = await props.searchParams;
  const { session, supabase } = await requireMember();
  if (session.profile.role === "lead") redirect("/");
  if (!supabase) return <><PageHeading>Accountability Buddy</PageHeading><p className="page-lede">This needs the database.</p></>;

  const [{ data: ab }, { data: mp }] = await Promise.all([
    supabase.from("ab_profiles").select("answers, complete, pool_status").maybeSingle(),
    supabase.from("member_private").select("rank_id").maybeSingle(),
  ]);
  const rankIdx = (mp as { rank_id: number | null } | null)?.rank_id ?? null;
  const rank = rankIdx ? RANKS[rankIdx - 1] : "";
  const answers = cleanAnswers({ ...((ab as { answers?: object } | null)?.answers ?? {}), ...(rank ? { rank } : {}) });
  const editing = sp.edit === "1" || !ab?.complete || !isComplete(answers);

  if (editing) return <BuddyQuestionnaire key={sp.edit === "1" ? "edit" : "new"} initial={answers} />;

  const status = (ab as { pool_status: string | null }).pool_status ?? "in_pool";
  let top: MatchCard[] = [], others: MatchCard[] = [];
  let buddy: { first_name: string | null; last_name: string | null; username: string | null; avatar_url: string | null } | null = null;
  if (status === "in_pool") {
    const { data } = await supabase.rpc("ab_matches_for_me");
    const all = (data ?? []) as MatchCard[];
    top = all.filter((m) => m.is_top);
    others = all.filter((m) => !m.is_top);
  } else if (status === "matched") {
    const { data } = await supabase.rpc("ab_my_buddy");
    buddy = ((data ?? []) as typeof buddy[])[0] ?? null;
  }
  return (
    <>
      <PageHeading lede="Find someone to keep you on track.">Accountability Buddy</PageHeading>
      <BuddyHome status={status} top={top} others={others} buddy={buddy} rank={rank || "4A"} />
    </>
  );
}
