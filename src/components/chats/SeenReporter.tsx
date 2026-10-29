"use client";

import { useEffect } from "react";
import { markSeen } from "@/app/(app)/chats/actions";

/** Tells the portal these posts were opened, so the eye counter can go up. Renders nothing. */
export function SeenReporter({ ids }: { ids: string[] }) {
  const key = ids.join(",");
  useEffect(() => { if (key) void markSeen(key.split(",")); }, [key]);
  return null;
}
