"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const TABLES = ["chat_posts", "chat_comments", "chat_reactions", "chat_votes"] as const;

/** Re-reads the page when anyone posts, replies, reacts or votes. Row level security still decides what each person receives. */
export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    let timer: number | undefined;
    const soon = () => { window.clearTimeout(timer); timer = window.setTimeout(() => router.refresh(), 400); };
    let ch = supabase.channel("chats-live");
    for (const table of TABLES) ch = ch.on("postgres_changes", { event: "*", schema: "public", table }, soon);
    ch.subscribe();
    return () => { window.clearTimeout(timer); void supabase.removeChannel(ch); };
  }, [router]);
  return null;
}
