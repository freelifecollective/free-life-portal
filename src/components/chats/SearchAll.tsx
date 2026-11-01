"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** "Search all chats", above the list of chats. */
export function SearchAll({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  return (
    <form className="chat-searchall" role="search" onSubmit={(e) => { e.preventDefault(); const t = q.trim(); if (t.length >= 2) router.push(`/chats/search?q=${encodeURIComponent(t)}`); }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search all chats" aria-label="Search all chats" minLength={2} maxLength={80} />
    </form>
  );
}
