"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** "Join the call" for a call held in the portal: it opens 15 minutes before and stays open for the length of the call plus an hour and a half. */
export function RoomLink({ id, startsAt, nowIso, minutes = 30 }: { id: string; startsAt: string; nowIso: string; minutes?: number }) {
  const [now, setNow] = useState(() => new Date(nowIso).getTime());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const start = new Date(startsAt).getTime();
  const opens = start - 15 * 60_000, closes = start + minutes * 60_000 + 90 * 60_000;
  if (now > closes) return null;
  if (now < opens) return <span className="when">The call room opens 15 minutes before.</span>;
  return <Link className="btn small primary" href={`/room/${id}`} style={{ textDecoration: "none" }}>Join the call</Link>;
}
