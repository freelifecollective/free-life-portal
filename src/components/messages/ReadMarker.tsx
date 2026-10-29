"use client";

import { useEffect } from "react";
import { markConversationRead } from "@/app/(app)/messages/actions";

/** Opening a conversation counts as reading it. Renders nothing. */
export function ReadMarker({ otherId }: { otherId: string }) {
  useEffect(() => { void markConversationRead(otherId); }, [otherId]);
  return null;
}
