import { PageHeading } from "@/components/PageHeading";
import { ReviewRow } from "@/components/admin/ReviewRow";
import { requireAdmin } from "@/lib/auth/guards";
import { authorsById } from "@/lib/chats/queries";
import { listSubmissions } from "@/lib/resources/queries";

export const instant = false;
export const metadata = { title: "Resource submissions" };

export default async function ResourceSubmissions() {
  const { supabase } = await requireAdmin();
  const subs = await listSubmissions(supabase);
  const authors = await authorsById(supabase, subs.map((s) => s.submitter_id));
  const withUrls = await Promise.all(subs.map(async (s) => ({
    ...s,
    urls: await Promise.all(s.files.map(async (f) => ({ name: f.name, url: (await supabase.storage.from("resource-submissions").createSignedUrl(f.path, 3600)).data?.signedUrl ?? null }))),
  })));
  const pending = withUrls.filter((s) => s.status === "pending");
  const done = withUrls.filter((s) => s.status !== "pending");
  return (
    <>
      <PageHeading lede="Resources members have offered to the community. Accepted resources become property of FLC.">Resource submissions</PageHeading>
      <h2 className="qh">Waiting for review ({pending.length})</h2>
      {pending.length === 0 ? <p className="page-lede">Nothing waiting. 🎉</p> : pending.map((s) => <ReviewRow key={s.id} sub={s} author={authors.get(s.submitter_id)?.name ?? "A member"} urls={s.urls} />)}
      {done.length ? <h2 className="qh" style={{ marginTop: 36 }}>Already reviewed</h2> : null}
      {done.map((s) => <ReviewRow key={s.id} sub={s} author={authors.get(s.submitter_id)?.name ?? "A member"} urls={s.urls} />)}
    </>
  );
}
