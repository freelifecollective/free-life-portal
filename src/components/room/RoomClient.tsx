"use client";

import { useRouter } from "next/navigation";
import { endRoom, roomBeat, roomEnded } from "@/app/(app)/room/actions";
import { supabaseSignal } from "@/lib/room/supabaseSignal";
import { CallRoom } from "./CallRoom";

export function RoomClient({ id, me, otherName, completed, back, host = false }: { id: string; me: string; otherName: string; completed: boolean; back: string; host?: boolean }) {
  const router = useRouter();
  return <CallRoom id={id} me={me} otherName={otherName} completedAlready={completed} makeSignal={supabaseSignal} beat={roomBeat} isHost={host} endCall={endRoom} checkEnded={roomEnded} onLeave={() => router.push(back)} />;
}
