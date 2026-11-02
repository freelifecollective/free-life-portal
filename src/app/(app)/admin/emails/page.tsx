import { PageHeading } from "@/components/PageHeading";
import { requireAdmin } from "@/lib/auth/guards";

export const instant = false;
export const metadata = { title: "Emails" };

type Row = { id: string; to_email: string; template: string; status: string; attempts: number; error: string | null; send_after: string; sent_at: string | null };
const when = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso)) : "");

export default async function EmailsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("email_outbox").select("id, to_email, template, status, attempts, error, send_after, sent_at").order("created_at", { ascending: false }).limit(80);
  const rows = (data ?? []) as Row[];
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const ready = !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
  const { count: unsubs } = await supabase.from("email_unsubscribes").select("email", { count: "exact", head: true });
  return (
    <>
      <PageHeading lede="The emails waiting to go out and the ones already sent. New leads get a welcome the moment they register, then one a day, three days and ten days later.">Emails</PageHeading>
      <section className="card-s" style={{ maxWidth: 680 }}>
        <p style={{ margin: 0 }}><b>{ready ? "Email sending is switched on." : "Email sending is not switched on yet."}</b> {ready ? "" : "Add RESEND_API_KEY, EMAIL_FROM and CRON_SECRET in Vercel and the waiting emails will start going out."}</p>
        <p className="when" style={{ margin: "8px 0 0" }}>Of the latest 80: {count("pending")} waiting · {count("sent")} sent · {count("failed")} failed · {count("skipped")} skipped. {unsubs ?? 0} people have unsubscribed.</p>
      </section>
      <div className="table-wrap" style={{ marginTop: 20 }}>
        <table className="admin-table">
          <thead><tr><th>To</th><th>Email</th><th>Status</th><th>Goes out</th><th>Notes</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id}><td>{r.to_email}</td><td>{r.template.replace(/_/g, " ")}</td><td>{r.status}</td><td>{when(r.sent_at ?? r.send_after)}</td><td>{r.error ?? ""}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  );
}
