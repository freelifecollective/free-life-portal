/** How the two people in a call room find each other: who is in the room, and the small messages that set up the connection. */
export type SigMsg = { from: string; kind: "offer" | "answer" | "ice"; data: unknown };
export type Signal = {
  send(msg: { kind: SigMsg["kind"]; data: unknown }): void;
  onMessage(cb: (m: SigMsg) => void): void;
  /** called with the ids of everyone in the room (including you) whenever that changes */
  onPeers(cb: (ids: string[]) => void): void;
  close(): void;
};
export type MakeSignal = (roomId: string, me: string) => Signal;

/** Between two tabs of the same browser (used for trying the room out without a server). */
export const localSignal: MakeSignal = (roomId, me) => {
  const ch = new BroadcastChannel(`room:${roomId}`);
  const peers = new Set<string>([me]);
  let msg: (m: SigMsg) => void = () => {};
  let ppl: (ids: string[]) => void = () => {};
  const announce = () => ppl([...peers]);
  ch.onmessage = (e) => {
    const d = e.data as { t: string; from: string; kind?: SigMsg["kind"]; data?: unknown };
    if (d.from === me) return;
    if (d.t === "hello") { const fresh = !peers.has(d.from); peers.add(d.from); if (fresh) ch.postMessage({ t: "hello", from: me }); announce(); }
    else if (d.t === "bye") { peers.delete(d.from); announce(); }
    else if (d.t === "sig" && d.kind) msg({ from: d.from, kind: d.kind, data: d.data });
  };
  setTimeout(() => { ch.postMessage({ t: "hello", from: me }); announce(); }, 0);
  return {
    send: (m) => ch.postMessage({ t: "sig", from: me, kind: m.kind, data: m.data }),
    onMessage: (cb) => { msg = cb; },
    onPeers: (cb) => { ppl = cb; },
    close: () => { ch.postMessage({ t: "bye", from: me }); ch.close(); },
  };
};
