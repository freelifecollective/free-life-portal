"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MAX_SECS = 300;
const mmss = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
/** The recording format this browser can make (Safari makes mp4, most others webm). */
function pickType(): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const [mime, ext] of [["audio/webm;codecs=opus", "webm"], ["audio/webm", "webm"], ["audio/mp4", "m4a"], ["audio/ogg;codecs=opus", "ogg"]] as const) {
    if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  }
  return null;
}

/**
 * A microphone button. Tap it to start recording, tap Send to upload the voice note and hand its address to the chat, or Cancel to throw it away.
 */
export function VoiceRecorder({ onSend, disabled = false }: { onSend: (url: string, secs: number) => void | Promise<void>; disabled?: boolean }) {
  const [state, setState] = useState<"idle" | "recording" | "sending">("idle");
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState("");
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const started = useRef(0);
  const keep = useRef(true);

  const stopTracks = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; window.clearInterval(timer.current); };
  useEffect(() => () => { keep.current = false; try { rec.current?.stop(); } catch { /* already stopped */ } stopTracks(); }, []);

  async function start() {
    setError("");
    const type = pickType();
    if (!type || !navigator.mediaDevices?.getUserMedia) { setError("This browser cannot record voice notes."); return; }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch { setError("Allow the microphone to record a voice note."); return; }
    chunks.current = [];
    keep.current = true;
    const r = new MediaRecorder(stream.current, { mimeType: type.mime });
    r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
    r.onstop = () => { void finish(type.ext, type.mime.split(";")[0]); };
    rec.current = r;
    r.start();
    started.current = Date.now();
    setSecs(0); setState("recording");
    timer.current = window.setInterval(() => {
      const s = Math.round((Date.now() - started.current) / 1000);
      setSecs(s);
      if (s >= MAX_SECS) stop(true);
    }, 500);
  }

  function stop(send: boolean) {
    keep.current = send;
    window.clearInterval(timer.current);
    try { rec.current?.stop(); } catch { /* already stopped */ }
  }

  async function finish(ext: string, mime: string) {
    const length = Math.max(1, Math.round((Date.now() - started.current) / 1000));
    stopTracks();
    if (!keep.current || chunks.current.length === 0) { setState("idle"); return; }
    setState("sending");
    try {
      const supabase = createClient();
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("not signed in");
      const path = `${u.user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: up } = await supabase.storage.from("voice-notes").upload(path, new Blob(chunks.current, { type: mime }), { contentType: mime, cacheControl: "3600" });
      if (up) throw up;
      await onSend(supabase.storage.from("voice-notes").getPublicUrl(path).data.publicUrl, Math.min(length, 600));
    } catch { setError("We could not send that voice note. Please try again."); }
    setState("idle");
  }

  if (state === "recording" || state === "sending") {
    return (
      <span className="vr-live" role="status">
        <i className="vr-dot" aria-hidden="true" />
        <b>{mmss(secs)}</b>
        {state === "sending" ? <span className="when">Sending…</span> : (
          <>
            <button type="button" className="linkbtn" style={{ padding: "0 6px" }} onClick={() => stop(false)}>Cancel</button>
            <button type="button" className="btn small primary" onClick={() => stop(true)}>Send</button>
          </>
        )}
      </span>
    );
  }
  return (
    <>
      <button type="button" className="dock-tool" aria-label="Record a voice note" title="Record a voice note" disabled={disabled} onClick={() => void start()}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
      </button>
      {error ? <span className="err vr-err" role="alert">{error}</span> : null}
    </>
  );
}
