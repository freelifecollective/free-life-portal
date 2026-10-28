import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { PageHeading } from "@/components/PageHeading";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { requireMember } from "@/lib/auth/guards";

export const instant = false;
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { session, supabase } = await requireMember();
  const p = session.profile;
  const initials = ((p.first_name ?? "").charAt(0) + (p.last_name ?? "").charAt(0)).toUpperCase() || "?";
  const isMember = p.role !== "lead";
  let rank: number | null = null;
  let ranks: { id: number; name: string }[] = [];
  if (supabase && isMember) {
    const [{ data: mine }, { data: all }] = await Promise.all([
      supabase.from("member_private").select("rank_id").maybeSingle(),
      supabase.from("ranks").select("id, name").order("sort"),
    ]);
    rank = (mine as { rank_id: number | null } | null)?.rank_id ?? null;
    ranks = (all ?? []) as { id: number; name: string }[];
  }
  return (
    <>
      <PageHeading>Settings</PageHeading>
      <div className="settings">
        <section className="card-s">
          <div className="who set-head">
            <Avatar url={p.avatar_url} initials={initials} size={72} preview={session.mode === "preview"} label="Your profile picture" />
            <span className="who-name"><strong style={{ fontSize: 20 }}>{[p.first_name, p.last_name].filter(Boolean).join(" ")}</strong>{p.role === "admin" ? <small className="admin-tag">Admin</small> : null}</span>
          </div>
          <p style={{ margin: "14px 0 0" }}><Link className="btn" href="/settings/picture" style={{ textDecoration: "none" }}>Change my picture</Link></p>
        </section>

        <section className="card-s">
          <h2 className="qh" style={{ marginTop: 0 }}>Your profile</h2>
          {supabase
            ? <SettingsForm first={p.first_name ?? ""} last={p.last_name ?? ""} username={p.username ?? ""} email={session.user.email ?? ""} instagram={p.instagram ?? ""} facebook={p.facebook ?? ""} isMember={isMember} rank={rank} ranks={ranks} />
            : <p style={{ margin: 0 }}>Editing needs the database, which preview mode does not have.</p>}
        </section>

        {isMember ? (
          <section className="card-s">
            <h2 className="qh" style={{ marginTop: 0 }}>Subscription and payments</h2>
            <dl className="set-list">
              <div><dt>Current subscription</dt><dd>Not connected yet</dd></div>
              <div><dt>Payment history</dt><dd>Not connected yet</dd></div>
              <div><dt>Receipts</dt><dd>Not connected yet</dd></div>
            </dl>
            <p className="when" style={{ margin: "10px 0 0" }}>These will fill in once monthly payments are connected to the portal.</p>
          </section>
        ) : null}

        <section className="card-s">
          <h2 className="qh" style={{ marginTop: 0 }}>General</h2>
          <form action="/logout" method="post"><button className="btn" type="submit">Sign out</button></form>
        </section>
      </div>
    </>
  );
}
