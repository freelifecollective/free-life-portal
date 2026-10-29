import { AnnouncementForm } from "@/components/admin/AnnouncementForm";
import { PageHeading } from "@/components/PageHeading";
import { requireAdmin } from "@/lib/auth/guards";
import { formatInZone } from "@/lib/time";

export const instant = false;
export const metadata = { title: "Announcements" };

export default async function AnnouncementsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("announcements").select("id, title, body, created_at").order("created_at", { ascending: false }).limit(30);
  return (
    <>
      <PageHeading lede="Tell everyone about a new feature. It appears in their notifications and is sent to their phone if they turned notifications on.">Announcements</PageHeading>
      <div className="settings" style={{ maxWidth: 620 }}>
        <AnnouncementForm />
        {(data ?? []).length ? (
          <section className="card-s">
            <h2 className="qh" style={{ marginTop: 0 }}>Sent so far</h2>
            <ul className="rs-mine">{(data ?? []).map((a) => <li key={a.id}><span><strong>{a.title}</strong>{a.body ? ` - ${a.body}` : ""}</span><span className="when">{formatInZone(new Date(a.created_at))}</span></li>)}</ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
