"use client";

import { useRouter } from "next/navigation";
import { roomBeat } from "@/app/(app)/room/actions";
import { supabaseSignal } from "@/lib/room/supabaseSignal";
import { CallRoom } from "./CallRoom";

export function RoomClient({ id, me, otherName, completed, back }: { id: string; me: string; otherName: string; completed: boolean; back: string }) {
  const router = useRouter();
  return <CallRoom id={id} me={me} otherName={otherName} completedAlready={completed} makeSignal={supabaseSignal} beat={roomBeat} onLeave={() => router.push(back)} />;
}
