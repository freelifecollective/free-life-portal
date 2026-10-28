"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { formatInZone } from "@/lib/time";
import type { PostView } from "@/lib/chats/types";
import { PostCard } from "./PostCard";

/** A pinned post: collapsed it shows a flashing red dot and "IMPORTANT - CLICK TO READ". Click to open the full post. */
export function PinnedPost({ post, slug, voting, isAdmin }: { post: PostView; slug: string; voting: boolean; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  if (open) {
    return (
      <div className="pinned open">
        <button type="button" className="linkbtn pinned-close" onClick={() => setOpen(false)}>Close pinned message</button>
        <PostCard post={post} slug={slug} voting={voting} isAdmin={isAdmin} />
      </div>
    );
  }
  return (
    <button type="button" className="pinned card-s" onClick={() => setOpen(true)} aria-label={`Important pinned message from ${post.author.name}. Click to read`}>
      <span className="pin-flag"><i className="pin-dot" aria-hidden="true" /><span className="pin-text">IMPORTANT - CLICK TO READ</span></span>
      <span className="pin-body">
        <span className="who"><Avatar url={post.author.avatar_url} initials={post.author.name.charAt(0).toUpperCase() || "?"} size={32} /><strong>{post.author.name}</strong><span className="when">{formatInZone(new Date(post.created_at))}</span></span>
        <span className="pin-preview">{post.body}</span>
      </span>
    </button>
  );
}
