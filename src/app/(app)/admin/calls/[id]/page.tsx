import { notFound } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { CallForm } from "@/components/admin/CallForm";
import { requireAdmin } from "@/lib/auth/guards";
import { CALL_COLUMNS, speakersOf, type Call } from "@/lib/calls/types";
import { toZonedInput } from "@/lib/time";
import { deleteCall, updateCall } from "../actions";

export const instant = false;
export const metadata = { title: "Edit call" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditCallPage({ params }: PageProps<"/admin/calls/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("calls").select(CALL_COLUMNS).eq("id", id).maybeSingle<Call>();
  if (!data) notFound();
  return (
    <>
      <PageHeading lede="Changes show on the calendar straight away.">Edit call</PageHeading>
      <section className="card-s" style={{ maxWidth: 680 }}>
        <CallForm
          submitLabel="Save changes"
          action={updateCall.bind(null, id)}
          initial={{ title: data.title, kind: data.kind, audience: data.audience, starts: toZonedInput(new Date(data.starts_at)), duration: data.duration_minutes, description: data.description ?? "", join_url: data.join_url ?? "", pinned: data.pinned, speakers: speakersOf(data).map((s) => ({ name: s.name, photo_url: s.photo_url ?? "" })) }}
        />
      </section>
      <form action={deleteCall.bind(null, id)} style={{ marginTop: 24 }}>
        <button className="linkbtn" type="submit" style={{ color: "var(--bad)" }}>Delete this call (RSVPs and registrations for it are deleted too)</button>
      </form>
    </>
  );
}
