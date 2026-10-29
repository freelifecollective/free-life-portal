"use client";

import Player from "@vimeo/player";
import { useEffect, useRef, useState } from "react";
import { markWatched } from "@/app/(app)/calls/actions";

/** The Vimeo player, trimmed: it starts at the chosen time and stops at the chosen end time (so late starts and trailing chatter are skipped). */
export function RecordingPlayer({ recordingId, vimeoId, hash, start, end, title }: { recordingId: string; vimeoId: string; hash: string | null; start: number; end: number | null; title: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ended, setEnded] = useState(false);
  const src = `https://player.vimeo.com/video/${vimeoId}?${hash ? `h=${hash}&` : ""}dnt=1&title=0&byline=0&portrait=0`;

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const player = new Player(el);
    let busy = false;
    let counted = false;
    const onPlaying = () => { if (!counted) { counted = true; void markWatched(recordingId); } };
    player.on("play", onPlaying);
    if (start === 0 && end === null) return () => { player.off("play", onPlaying); void player.destroy(); };
    const jump = async () => { try { await player.setCurrentTime(start); } catch { /* not ready yet */ } };
    void player.ready().then(jump);
    const onTime = async ({ seconds }: { seconds: number }) => {
      if (busy) return;
      if (seconds < start - 0.5) { busy = true; await jump(); busy = false; }
      else if (end !== null && seconds >= end) { busy = true; await player.pause(); setEnded(true); busy = false; }
    };
    player.on("timeupdate", onTime);
    player.on("play", () => setEnded(false));
    return () => { player.off("timeupdate", onTime); player.off("play", onPlaying); void player.destroy(); };
  }, [start, end, recordingId]);

  return (
    <div className="rec-player">
      <iframe ref={frame} src={src} title={title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
      {ended ? <p className="when" role="status" style={{ marginTop: 8 }}>That is the end of the recording.</p> : null}
    </div>
  );
}
