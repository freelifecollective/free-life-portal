"use client";

import { useEffect } from "react";
import { markRead } from "@/app/(app)/groups/actions";

/** Tells the portal you have seen the latest messages in this group (so the unread number goes away). */
export function MarkRead({ groupId, lastId }: { groupId: string; lastId: string | null }) {
  useEffect(() => { void markRead(groupId); }, [groupId, lastId]);
  return null;
}
