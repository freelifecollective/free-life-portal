import { createClient } from "@/lib/supabase/client";
import type { MakeSignal, SigMsg } from "./signal";

/** The real thing: Supabase Realtime carries the room's presence and the connection set-up messages. */
export const supabaseSignal: MakeSignal = (roomId, me) => {
  const ch = createClient().channel(`room:${roomId}`, { config: { broadcast: { self: false }, presence: { key: me } } });
  let ppl: (ids: string[]) => void = () => {};
  let msg: (m: SigMsg) => void = () => {};
  ch.on("broadcast", { event: "sig" }, ({ payload }) => msg(payload as SigMsg));
  ch.on("presence", { event: "sync" }, () => ppl(Object.keys(ch.presenceState())));
  ch.subscribe((status) => { if (status === "SUBSCRIBED") void ch.track({ at: Date.now() }); });
  return {
    send: (m) => { void ch.send({ type: "broadcast", event: "sig", payload: { from: me, kind: m.kind, data: m.data } }); },
    onMessage: (cb) => { msg = cb; },
    onPeers: (cb) => { ppl = cb; },
    close: () => { void ch.untrack(); void createClient().removeChannel(ch); },
  };
};
