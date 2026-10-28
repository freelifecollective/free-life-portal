"use client";

import { useSyncExternalStore } from "react";
import { CALL_ZONE, formatInZone } from "@/lib/time";

const subscribe = () => () => {};

/** "Your time: Tue, Nov 4, 4:00 PM PST", shown only when the visitor is not in Eastern time. Empty on the server. */
export function LocalTime({ iso }: { iso: string }) {
  const text = useSyncExternalStore(
    subscribe,
    () => {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const d = new Date(iso);
      const mine = formatInZone(d, zone), theirs = formatInZone(d, CALL_ZONE);
      return mine === theirs ? "" : mine;
    },
    () => "",
  );
  return text ? <span className="local-time">Your time: {text}</span> : null;
}
