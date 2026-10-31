"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addMyPage, removePage, setFollow } from "@/app/(app)/facebook-follows/actions";
import { Avatar } from "@/components/Avatar";
import { ProfileCard, type MemberPerson } from "@/components/chats/ProfileCard";
import { createClient } from "@/lib/supabase/client";

export type Listing = { member_id: string; first_name: string | null; last_name: string | null; username: string | null; avatar_url: string | null; page_url: string; follows: number; i_followed: boolean; created_at: string; completed_at: string | null; is_me: boolean };
const GOAL = 50;
const nameOf = (l: Pick<Listing, "first_name" | "last_name">) => [l.first_name, l.last_name].filter(Boolean).join(" ") || "Member";
/** Facebook's own "page plugin": shows the page's name, picture, cover photo and follower count. It only works for public Facebook Pages, not personal profiles. */
function PagePreview({ url, name }: { url: string; name: string }) {
  const src = `https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(url)}&tabs&width=340&height=130&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=false`;
  return (
    <div className="ff-preview">
      <iframe src={src} title={`${name}'s Facebook page`} width="340" height="130" loading="lazy" style={{ border: 0, overflow: "hidden", maxWidth: "100%" }} scrolling="no" allow="encrypted-media" />
    </div>
  );
}
const initialsOf = (l: Pick<Listing, "first_name" | "last_name">) => ((l.first_name ?? "").charAt(0) + (l.last_name ?? "").charAt(0)).toUpperCase() || "?";

function Progress({ n }: { n: number }) {
  const shown = Math.min(n, GOAL);
  return (
    <div className="ff-progress">
      <div className="ff-bar" role="progressbar" aria-valuemin={0} aria-valuemax={GOAL} aria-valuenow={shown} aria-label="Follows so far"><i style={{ width: `${(shown / GOAL) * 100}%` }} /></div>
      <span className="when"><strong>{shown}</strong> of {GOAL} follows{shown < GOAL ? ` · ${GOAL - shown} to go` : ""}</span>
    </div>
  );
}

/** My own Facebook page card, then everyone else's pages that still need follows. */
export function FollowsBoard({ listings, isAdmin, canList, suggested }: { listings: Listing[]; isAdmin: boolean; canList: boolean; suggested: string }) {
  const router = useRouter();
  const [pending, run] = useTransition();
  const [page, setPage] = useState(suggested);
  const [error, setError] = useState("");
  const [person, setPerson] = useState<MemberPerson | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const mine = listings.find((l) => l.is_me) ?? null;
  /* every page that still needs follows, mine first (the database already puts it first) */
  const shown = listings.filter((l) => !l.completed_at);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) => { setError(""); run(async () => { const r = await fn(); if (!r.ok) setError(r.error ?? "That did not work."); router.refresh(); }); };

  async function openProfile(id: string) {
    const { data } = await createClient().rpc("speaker_profile", { p_id: id });
    const r = ((data ?? []) as ({ found: boolean } & MemberPerson)[])[0];
    if (!r?.found) return;
    setPerson(r);
    dlg.current?.showModal();
  }

  return (
    <div className="ff">
      {canList ? (
        <section className="card-s ff-mine" aria-label="Your Facebook page">
          {!mine ? (
            <form onSubmit={(e) => { e.preventDefault(); act(() => addMyPage(page)); }}>
              <h2 className="qh" style={{ marginTop: 0 }}>Get your first 50 follows</h2>
              <p className="when" style={{ margin: "0 0 12px" }}>Add your Facebook page or profile link and the community can follow you. When you reach 50, you come off the list.</p>
              <div className="field"><label htmlFor="ff-page">Your Facebook page link</label>
                <input id="ff-page" type="text" autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="facebook.com/yourpage" value={page} onChange={(e) => setPage(e.target.value)} /></div>
              <div className="dlg-actions" style={{ justifyContent: "flex-start" }}><button type="submit" className="btn primary" disabled={pending || !page.trim()}>{pending ? "Adding…" : "Add my page"}</button></div>
            </form>
          ) : (
            <>
              <div className="ff-head">
                <h2 className="qh" style={{ margin: 0 }}>{mine.completed_at ? "🎉 You reached 50 follows!" : "Your page is on the list"}</h2>
                <a className="linkbtn" href={mine.page_url} target="_blank" rel="noopener noreferrer">View your page</a>
              </div>
              <Progress n={mine.follows} />
              {mine.completed_at ? <p className="when" style={{ margin: 0 }}>Thank you, community! Your page has come off the list.</p> : <p className="when" style={{ margin: 0 }}>Everyone on the list below can follow you and tap “I followed”.</p>}
              <div><button type="button" className="linkbtn" disabled={pending} onClick={() => { if (window.confirm(mine.completed_at ? "Remove this from your page?" : "Take your page off the list?")) act(() => removePage()); }}>{mine.completed_at ? "Clear this" : "Remove my page from the list"}</button></div>
            </>
          )}
        </section>
      ) : null}

      <p className="err" role="alert" style={{ margin: 0 }}>{error}</p>

      <h2 className="qh" style={{ margin: "6px 0 0" }}>Pages that need follows{shown.length ? ` · ${shown.length}` : ""}</h2>
      {shown.length === 0 ? <section className="card-s"><p style={{ margin: 0 }}>Nobody needs follows right now. New pages will show up here.</p></section> : (
        <ul className="ff-list">
          {shown.map((l) => (
            <li key={l.member_id} className={"card-s ff-card" + (l.is_me ? " me" : "")}>
              <button type="button" className="ff-who" onClick={() => void openProfile(l.member_id)} aria-label={`See ${nameOf(l)}'s profile`}>
                <Avatar url={l.avatar_url} initials={initialsOf(l)} size={52} />
                <span><strong>{nameOf(l)}{l.is_me ? " (you)" : ""}</strong>{l.username ? <small>@{l.username}</small> : null}</span>
              </button>
              <PagePreview url={l.page_url} name={nameOf(l)} />
              <Progress n={l.follows} />
              <div className="ff-actions">
                <a className="btn small" href={l.page_url} target="_blank" rel="noopener noreferrer">Open their page</a>
                {l.is_me ? <span className="when">This is your page</span> : <button type="button" className={"btn small" + (l.i_followed ? " primary" : "")} aria-pressed={l.i_followed} disabled={pending} onClick={() => act(() => setFollow(l.member_id, !l.i_followed))}>{l.i_followed ? "✓ I followed" : "I followed"}</button>}
                {isAdmin && !l.is_me ? <button type="button" className="linkbtn" disabled={pending} onClick={() => { if (window.confirm(`Take ${nameOf(l)}'s page off the list?`)) act(() => removePage(l.member_id)); }}>Remove (admin)</button> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="when">Facebook doesn&rsquo;t tell us who followed, so the count is the follows people confirm here. Please only tap &ldquo;I followed&rdquo; after you have followed their page. The page previews come straight from Facebook (name, picture, cover and followers) and only show for public Facebook Pages, not personal profiles.</p>

      <dialog ref={dlg} className="rs-dialog members-dialog" aria-label="Profile" onClose={() => setPerson(null)} onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}>
        {person ? <ProfileCard p={person} canMessage onClose={() => dlg.current?.close()} /> : null}
      </dialog>
    </div>
  );
}
