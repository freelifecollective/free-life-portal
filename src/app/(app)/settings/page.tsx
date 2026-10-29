import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { PageHeading } from "@/components/PageHeading";
import { QuoteStyle } from "@/components/settings/QuoteStyle";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { isQuoteStyle, type QuoteStyle as Style } from "@/lib/quotes";
import { requireMember } from "@/lib/auth/guards";

export const instant = false;
export const metadata = { title: "Profile" };

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
  let quoteStyle: Style = "general";
  if (supabase) {
    const { data } = await supabase.from("member_prefs").select("quote_style").maybeSingle();
    if (isQuoteStyle(data?.quote_style)) quoteStyle = data.quote_style;
  }
  return (
    <div className="account">
      <PageHeading>Profile</PageHeading>
      <div className="settings">
        <section className="card-s">
          <div className="who set-head">
            <Link href="/settings/picture" className="avatar-edit" aria-label="Edit your picture">
              <Avatar url={p.avatar_url} initials={initials} size={96} preview={session.mode === "preview"} label="Your profile picture" />
              <span className="avatar-edit-btn" aria-hidden="true">Edit</span>
            </Link>
            <span className="who-name"><strong style={{ fontSize: 20 }}>{[p.first_name, p.last_name].filter(Boolean).join(" ")}</strong>{p.role === "admin" ? <small className="admin-tag">Admin</small> : null}</span>
          </div>
        </section>

        <section className="card-s">
          <h2 className="qh" style={{ marginTop: 0 }}>Your profile</h2>
          {supabase
            ? <SettingsForm first={p.first_name ?? ""} last={p.last_name ?? ""} username={p.username ?? ""} email={session.user.email ?? ""} instagram={p.instagram ?? ""} facebook={p.facebook ?? ""} isMember={isMember} rank={rank} ranks={ranks} />
            : <p style={{ margin: 0 }}>Editing needs the database, which preview mode does not have.</p>}
        </section>

        {supabase ? (
          <section className="card-s">
            <h2 className="qh" style={{ marginTop: 0 }}>Daily quote</h2>
            <p className="when" style={{ margin: "0 0 12px" }}>A new quote appears under your welcome on Home every day. Choose the kind you would like.</p>
            <QuoteStyle current={quoteStyle} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
