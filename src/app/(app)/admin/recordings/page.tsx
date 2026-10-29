import { PageHeading } from "@/components/PageHeading";
import { RecordingsAdmin } from "@/components/calls/RecordingsAdmin";
import { requireAdmin } from "@/lib/auth/guards";
import { nowMs } from "@/lib/time";
import { listRecordings } from "@/lib/recordings/queries";

export const instant = false;
export const metadata = { title: "Manage recordings" };

export default async function ManageRecordings() {
  const { supabase } = await requireAdmin();
  const [recordings, { data: calls }] = await Promise.all([
    listRecordings(supabase),
    supabase.from("calls").select("id, title, starts_at").lte("starts_at", new Date(nowMs() + 86400000).toISOString()).order("starts_at", { ascending: false }).limit(60),
  ]);
  return (
    <>
      <PageHeading lede="Add the Vimeo recording of a call, choose who can watch it, trim the start and end, then publish it.">Manage recordings</PageHeading>
      <RecordingsAdmin recordings={recordings} calls={(calls ?? []) as { id: string; title: string; starts_at: string }[]} />
    </>
  );
}
