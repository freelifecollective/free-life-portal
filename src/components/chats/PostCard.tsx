"use client";

import { useActionState, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { addComment, deleteComment, deletePost, toggleVote, type ChatFormState } from "@/app/(app)/chats/actions";
import { Avatar } from "@/components/Avatar";
import { COMMENT_MAX, type Author, type PostView } from "@/lib/chats/types";
import { Reactions } from "./Reactions";
import { formatInZone } from "@/lib/time";

function When({ iso }: { iso: string }) {
  return <time dateTime={iso} className="when">{formatInZone(new Date(iso))}</time>;
}

function Who({ a, size = 40 }: { a: Author; size?: number }) {
  const initials = a.name.charAt(0).toUpperCase() || "?";
  const inner = <><Avatar url={a.avatar_url} initials={initials} size={size} /><strong>{a.name}</strong></>;
  return <span className="who">{inner}</span>;
}

function CommentForm({ postId, slug }: { postId: string; slug: string }) {
  const [state, action, pending] = useActionState(addComment.bind(null, postId, slug), { error: "" } as ChatFormState);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.sent) form.current?.reset(); }, [state.sent]);
  return (
    <form ref={form} action={action} className="comment-form">
      <label className="sr-only" htmlFor={`c-${postId}`}>Reply</label>
      <input id={`c-${postId}`} name="body" type="text" maxLength={COMMENT_MAX} placeholder="Write a reply…" required />
      <button className="btn small" type="submit" disabled={pending}>Reply</button>
      {state.error ? <p className="err" role="alert" style={{ minHeight: 0, margin: 0, flexBasis: "100%" }}>{state.error}</p> : null}
    </form>
  );
}

export function PostCard({ post, slug, voting, isAdmin }: { post: PostView; slug: string; voting: boolean; isAdmin: boolean }) {
  const [, start] = useTransition();
  const [error, setError] = useState("");
  const [vote, setVote] = useOptimistic({ votes: post.votes, voted: post.voted }, (cur, next: boolean) => (next === cur.voted ? cur : { votes: cur.votes + (next ? 1 : -1), voted: next }));
  const canDelete = post.mine || isAdmin;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, optimistic?: () => void) {
    setError("");
    start(async () => { optimistic?.(); const r = await fn(); if (!r.ok) setError(r.error ?? "That did not work."); });
  }

  return (
    <article className="post card-s">
      <header className="post-head">
        <Who a={post.author} />
        <span className="when-wrap"><When iso={post.created_at} />{post.edited ? " (edited)" : ""}</span>
      </header>
      <p className="post-body">{post.body}</p>
      <div className="post-actions">
        <Reactions postId={post.id} slug={slug} reactions={post.reactions} mine={post.myReaction} onError={setError} />
        {voting && !post.mine ? (
          <button type="button" className={"vote" + (vote.voted ? " on" : "")} aria-pressed={vote.voted}
            onClick={() => run(() => toggleVote(post.id, slug, !vote.voted), () => setVote(!vote.voted))}>
            {vote.voted ? "Voted" : "Vote for this answer"}<span className="n">{vote.votes}</span>
          </button>
        ) : voting ? <span className="vote-count">{vote.votes} {vote.votes === 1 ? "vote" : "votes"}</span> : null}
        {canDelete ? (
          <button type="button" className="linkbtn danger" onClick={() => { if (window.confirm("Delete this post?")) run(() => deletePost(post.id, slug)); }}>Delete</button>
        ) : null}
      </div>
      {error ? <p className="err" role="alert" style={{ minHeight: 0 }}>{error}</p> : null}
      {post.comments.length ? (
        <ul className="comments">
          {post.comments.map((c) => (
            <li key={c.id}>
              <Who a={c.author} size={28} /> <When iso={c.created_at} />
              <p>{c.body}</p>
              {c.mine || isAdmin ? <button type="button" className="linkbtn danger" onClick={() => run(() => deleteComment(c.id, slug))}>Delete</button> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <CommentForm postId={post.id} slug={slug} />
    </article>
  );
}
