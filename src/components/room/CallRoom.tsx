"use client";

import { useEffect, useRef, useState } from "react";
import type { MakeSignal } from "@/lib/room/signal";

type Beat = (id: string) => Promise<{ completed: boolean }>;

const turn = (process.env.NEXT_PUBLIC_TURN_URLS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const ICE: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  ...(turn.length ? [{ urls: turn, username: process.env.NEXT_PUBLIC_TURN_USER ?? "", credential: process.env.NEXT_PUBLIC_TURN_PASS ?? "" }] : []),
];

/**
 * A video call between two people, right in the portal. The video goes straight between them; the portal only helps them find each other,
 * and notes (every 20 seconds, while they are connected) that the call is happening. After five minutes together it counts as a completed call.
 */
export function CallRoom({ id, me, otherName, completedAlready, makeSignal, beat, onLeave, isHost = false, endCall, checkEnded }: {
  id: string; me: string; otherName: string; completedAlready: boolean; makeSignal: MakeSignal; beat: Beat; onLeave: () => void;
  isHost?: boolean; endCall?: (id: string) => Promise<{ ok: boolean }>; checkEnded?: (id: string) => Promise<boolean>;
}) {
  const local = useRef<HTMLVideoElement>(null);
  const remote = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [state, setState] = useState<"starting" | "waiting" | "connecting" | "live" | "problem">("starting");
  const [problem, setProblem] = useState("");
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [done, setDone] = useState(completedAlready);
  const [ended, setEnded] = useState(false);
  const connected = useRef(false);
  const beatRef = useRef(beat);
  useEffect(() => { beatRef.current = beat; });

  useEffect(() => {
    let alive = true;
    let pc: RTCPeerConnection | null = null;
    let remoteSet = false;
    let pending: RTCIceCandidateInit[] = [];
    let sig: ReturnType<MakeSignal> | null = null;

    const closePc = () => { if (pc) { pc.onconnectionstatechange = null; pc.close(); } pc = null; remoteSet = false; pending = []; connected.current = false; };
    const fresh = () => {
      closePc();
      const p = new RTCPeerConnection({ iceServers: ICE });
      pc = p;
      stream.current?.getTracks().forEach((t) => p.addTrack(t, stream.current!));
      p.ontrack = (e) => { if (remote.current) remote.current.srcObject = e.streams[0]; };
      p.onicecandidate = (e) => { if (e.candidate) sig?.send({ kind: "ice", data: e.candidate.toJSON() }); };
      p.onconnectionstatechange = () => {
        if (!alive) return;
        const s = p.connectionState;
        connected.current = s === "connected";
        if (s === "connected") setState("live");
        else if (s === "connecting") setState("connecting");
        else if (s === "failed") { setState("problem"); setProblem("The connection between you could not be made. Check your internet, or ask them to rejoin. Some work or school networks block calls."); }
        else if (s === "disconnected") setState("connecting");
      };
      return p;
    };
    const flush = async () => { for (const c of pending) { try { await pc?.addIceCandidate(c); } catch { /* a late or duplicate candidate */ } } pending = []; };

    (async () => {
      try {
        try { stream.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); }
        catch { stream.current = await navigator.mediaDevices.getUserMedia({ audio: true }); setCam(false); }
      } catch {
        if (alive) { setState("problem"); setProblem("We could not reach your camera or microphone. Allow them for this site in your browser, then reload the page."); }
        return;
      }
      if (!alive) { stream.current?.getTracks().forEach((t) => t.stop()); return; }
      if (local.current) local.current.srcObject = stream.current;
      setState("waiting");
      sig = makeSignal(id, me);
      sig.onPeers((ids) => {
        const other = ids.find((x) => x !== me);
        if (!other) { closePc(); if (alive) setState("waiting"); return; }
        /* the person with the smaller id starts the connection, so both never try at once */
        if (me < other && (!pc || pc.connectionState === "failed" || pc.connectionState === "closed")) {
          const p = fresh();
          void (async () => { const o = await p.createOffer(); await p.setLocalDescription(o); sig?.send({ kind: "offer", data: o }); })();
        }
      });
      sig.onMessage(async (m) => {
        if (!alive) return;
        if (m.kind === "offer") {
          const p = fresh();
          await p.setRemoteDescription(m.data as RTCSessionDescriptionInit); remoteSet = true; await flush();
          const a = await p.createAnswer(); await p.setLocalDescription(a); sig?.send({ kind: "answer", data: a });
        } else if (m.kind === "answer") {
          if (pc && !remoteSet) { await pc.setRemoteDescription(m.data as RTCSessionDescriptionInit); remoteSet = true; await flush(); }
        } else if (m.kind === "ice") {
          if (pc && remoteSet) { try { await pc.addIceCandidate(m.data as RTCIceCandidateInit); } catch { /* ignore */ } } else pending.push(m.data as RTCIceCandidateInit);
        }
      });
    })();

    /* while connected, tell the portal the call is happening (it counts the time you are both there) */
    const timer = window.setInterval(() => {
      if (!connected.current) return;
      void beatRef.current(id).then((r) => { if (alive && r.completed) setDone(true); }).catch(() => {});
    }, 20_000);
    const first = window.setTimeout(() => { if (connected.current) void beatRef.current(id).then((r) => { if (alive && r.completed) setDone(true); }).catch(() => {}); }, 4000);

    /* the call stays open until the person taking it ends it; the other person finds out within a few seconds */
    const watch = window.setInterval(() => { if (!isHost && checkEnded) void checkEnded(id).then((e) => { if (alive && e) setEnded(true); }).catch(() => {}); }, 8000);

    return () => {
      alive = false;
      window.clearInterval(watch);
      window.clearInterval(timer); window.clearTimeout(first);
      closePc(); sig?.close();
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, [id, me, makeSignal, isHost, checkEnded]);

  const toggle = (kind: "audio" | "video") => {
    const tracks = kind === "audio" ? stream.current?.getAudioTracks() : stream.current?.getVideoTracks();
    if (!tracks?.length) return;
    const on = !tracks[0].enabled;
    tracks.forEach((t) => { t.enabled = on; });
    if (kind === "audio") setMic(on); else setCam(on);
  };
  const line = state === "starting" ? "Getting your camera ready…" : state === "waiting" ? `Waiting for ${otherName} to join…` : state === "connecting" ? "Connecting…" : state === "live" ? `You are connected with ${otherName}.` : problem;

  if (ended) {
    return (
      <div className="room" data-state="ended">
        <div className="room-stage"><div className="room-wait" role="status"><p>{`${otherName} has ended the call. Thank you for joining!`}</p></div></div>
        <div className="room-bar"><button type="button" className="room-btn leave" onClick={onLeave}>Close</button></div>
      </div>
    );
  }
  return (
    <div className="room" data-state={state}>
      <div className="room-stage">
        <video ref={remote} className="room-remote" autoPlay playsInline data-testid="remote" />
        {state !== "live" ? <div className="room-wait" role="status"><p>{line}</p></div> : null}
        <video ref={local} className="room-local" autoPlay playsInline muted data-testid="local" />
      </div>
      <div className="room-bar">
        <button type="button" className={"room-btn" + (mic ? "" : " off")} onClick={() => toggle("audio")} aria-pressed={!mic}>{mic ? "Mute" : "Unmute"}</button>
        <button type="button" className={"room-btn" + (cam ? "" : " off")} onClick={() => toggle("video")} aria-pressed={!cam}>{cam ? "Camera off" : "Camera on"}</button>
        <button type="button" className="room-btn leave" onClick={onLeave}>Leave</button>
        {isHost && endCall ? <button type="button" className="room-btn leave" onClick={() => { if (window.confirm(`End the call for everyone? ${otherName} will be disconnected.`)) void endCall(id).then(onLeave); }}>End call for everyone</button> : null}
      </div>
      {state === "live" ? <p className="when room-note" role="status">{done ? "This call has been counted as completed. ✓" : "Once you have been together for five minutes, this call is counted as completed automatically."}</p> : null}
      {state === "problem" ? <p className="err" role="alert">{problem}</p> : null}
    </div>
  );
}
