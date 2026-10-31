import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { PageHeading } from "@/components/PageHeading";
import { ProfileBadges } from "@/components/badges/ProfileBadges";
import type { BadgeState } from "@/lib/badges/defs";
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
  let extra = null as { birth_month: number | null; birth_day: number | null; birth_year: number | null } | null;
  let ranks: { id: number; name: string }[] = [];
  if (supabase && isMember) {
    const [{ data: mine }, { data: all }, { data: ex }] = await Promise.all([
      supabase.from("member_private").select("rank_id").maybeSingle(),
      supabase.from("ranks").select("id, name").order("sort"),
      supabase.from("profiles").select("birth_month, birth_day, birth_year").eq("id", session.user.id).maybeSingle(),
    ]);
    extra = (ex as typeof extra) ?? null;
    rank = (mine as { rank_id: number | null } | null)?.rank_id ?? null;
    ranks = (all ?? []) as { id: number; name: string }[];
  }
  let badges: BadgeState | null = null;
  if (supabase && isMember) {
    const { data } = await supabase.rpc("badge_state");
    badges = (data as BadgeState | null) ?? null;
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
        <div className="set-top">
        <section className="card-s set-who">
          <div className="who set-head">
            <Link href="/settings/picture" className="avatar-edit" aria-label="Edit your picture">
              <Avatar url={p.avatar_url} initials={initials} size={80} preview={session.mode === "preview"} label="Your profile picture" />
              <span className="avatar-edit-btn" aria-hidden="true">Edit</span>
            </Link>
            <span className="who-name"><strong style={{ fontSize: 18 }}>{[p.first_name, p.last_name].filter(Boolean).join(" ")}</strong>{p.role === "admin" ? <small className="admin-tag">Admin</small> : null}</span>
          </div>
        </section>
        {supabase ? (
          <section className="card-s set-quote">
            <h2 className="qh" style={{ marginTop: 0, fontSize: 18 }}>Daily quote</h2>
            <p className="when" style={{ margin: "0 0 10px" }}>A new quote appears under your welcome on Home every day. Choose the kind you would like.</p>
            <QuoteStyle current={quoteStyle} />
          </section>
        ) : null}
        </div>

        <section className="card-s">
          <h2 className="qh" style={{ marginTop: 0 }}>Your profile</h2>
          {supabase
            ? <SettingsForm first={p.first_name ?? ""} last={p.last_name ?? ""} username={p.username ?? ""} email={session.user.email ?? ""} instagram={p.instagram ?? ""} facebook={p.facebook ?? ""} isMember={isMember} rank={rank} ranks={ranks} birthMonth={extra?.birth_month ?? null} birthDay={extra?.birth_day ?? null} birthYear={extra?.birth_year ?? null} />
            : <p style={{ margin: 0 }}>Editing needs the database, which preview mode does not have.</p>}
        </section>

        {badges ? (
          <section className="card-s">
            <h2 className="qh" style={{ marginTop: 0 }}>My badges</h2>
            <ProfileBadges state={badges} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
