import { redirect } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { BadgesPanel } from "@/components/badges/BadgesPanel";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import type { BadgeState } from "@/lib/badges/defs";
import { requireMember } from "@/lib/auth/guards";
import { getTz, listTasks, todayIn } from "@/lib/tasks/queries";

export const instant = false;
export const metadata = { title: "Tasks" };

export default async function TasksPage() {
  const { session, supabase } = await requireMember();
  if (session.profile.role === "lead") redirect("/");
  if (!supabase) return <><PageHeading>Tasks</PageHeading><p className="page-lede">Tasks need the database, which preview mode does not have.</p></>;
  const tz = await getTz(supabase);
  const [tasks, { data: badgeData }] = await Promise.all([listTasks(supabase), supabase.rpc("badge_state")]);
  const badges = (badgeData as BadgeState | null) ?? null;
  return (
    <div className="tasks-page">
      <PageHeading lede="Everything you want to get done, for your business and your life. Tick things off, reorder them, and we will remind you.">Tasks</PageHeading>
      <TaskBoard initial={tasks} today={todayIn(tz)} tz={tz} />
      {badges ? <div style={{ marginTop: 34 }}><BadgesPanel state={badges} /></div> : null}
    </div>
  );
}
