import { notFound, redirect } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { BirthdayParty, type Wish } from "@/components/birthday/BirthdayParty";
import { requireMember } from "@/lib/auth/guards";
import { nowMs } from "@/lib/time";

export const instant = false; // depends on who is signed in
export const metadata = { title: "Birthday" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function BirthdayPage(props: PageProps<"/birthday/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const { session, supabase } = await requireMember();
  if (!supabase) notFound();
  if (id === "me") redirect(`/birthday/${session.user.id}`);
  if (!UUID.test(id)) notFound();
  const yRaw = Number(Array.isArray(sp.y) ? sp.y[0] : sp.y);
  const year = Number.isInteger(yRaw) && yRaw >= 2000 && yRaw <= 2200 ? yRaw : new Date(nowMs()).getUTCFullYear();
  const { data: who } = await supabase.rpc("birthday_person", { p_person: id, p_year: year });
  const p = ((who ?? []) as { first_name: string | null; last_name: string | null; avatar_url: string | null; is_open: boolean; is_me: boolean }[])[0];
  if (!p) {
    return <><PageHeading>Birthday</PageHeading><p className="page-lede">Birthday chats are for paying affiliates.</p></>;
  }
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ") || "A member";
  const [{ data: wishes }, { data: cards }] = await Promise.all([
    supabase.rpc("birthday_wishes_list", { p_person: id, p_year: year }),
    p.is_me ? supabase.rpc("my_birthday_cards") : Promise.resolve({ data: [] }),
  ]);
  return (
    <>
      <PageHeading lede={p.is_me ? `Your birthday ${year}` : undefined}>{p.is_me ? "Happy Birthday!" : `${name}'s birthday`}</PageHeading>
      <BirthdayParty personId={id} name={name} year={year} isOpen={p.is_open} isMe={p.is_me} isAdmin={session.profile.role === "admin"}
        wishes={(wishes ?? []) as Wish[]} otherYears={((cards ?? []) as { year: number; wishes: number }[]).map((c) => ({ year: c.year, wishes: Number(c.wishes) }))} />
    </>
  );
}
