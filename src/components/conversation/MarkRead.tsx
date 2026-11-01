"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { markChatRead } from "@/app/(app)/chats/actions";
import { markRead } from "@/app/(app)/groups/actions";

/** Tells the portal you have seen the latest messages here, so the unread numbers go away (and others see "seen"). */
export function MarkRead({ kind = "group", groupId, lastId, unread = 0 }: { kind?: "chat" | "group"; groupId: string; lastId: string | null; unread?: number }) {
  const router = useRouter();
  useEffect(() => {
    let live = true;
    void (kind === "chat" ? markChatRead(groupId) : markRead(groupId)).then(() => { if (live && unread > 0) router.refresh(); });
    return () => { live = false; };
  }, [kind, groupId, lastId, unread, router]);
  return null;
}
