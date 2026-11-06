import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { RoomClient } from "@/components/room/RoomClient";
import { requireMember } from "@/lib/auth/guards";

export const instant = false;
export const metadata = { title: "Call" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function RoomPage(props: PageProps<"/room/[id]">) {
  const { id } = await props.params;
  const { session, supabase } = await requireMember();
  if (!supabase || !UUID.test(id)) notFound();
  const { data } = await supabase.rpc("room_info", { p_call: id });
  const r = ((data ?? []) as { id: string; starts_at: string; my_role: "lead" | "host"; other_name: string | null; completed: boolean; open_now: boolean; ended: boolean }[])[0];
  if (!r) notFound();
  const back = r.my_role === "lead" ? "/book" : session.profile.call_closer ? "/call-closer" : "/";
  const other = r.other_name ?? (r.my_role === "lead" ? "your coach" : "the lead");
  return (
    <>
      <p style={{ margin: "0 0 8px" }}><Link className="doc-back" href={back}>← Back</Link></p>
      <PageHeading lede={new Date(r.starts_at).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" })}>{`Call with ${other}`}</PageHeading>
      {r.open_now ? <RoomClient id={id} me={session.user.id} otherName={other} completed={r.completed} back={back} host={r.my_role === "host"} /> : (
        <section className="card-s" style={{ maxWidth: 560 }}><p style={{ margin: 0 }}>{r.ended || r.completed ? "This call has ended." : "The call room opens 15 minutes before the call starts."}</p></section>
      )}
    </>
  );
}
