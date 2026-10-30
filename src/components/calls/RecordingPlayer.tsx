"use client";

import Player from "@vimeo/player";
import { useEffect, useRef, useState } from "react";
import { recordView } from "@/app/(app)/calls/actions";
import { BadgeToast } from "@/components/badges/BadgeToast";

/** Points along the replay at which we note how far someone has got. Past 80% counts as watched. */
const MARKS = [1, 25, 50, 80, 100];

/**
 * The Vimeo player, trimmed: it starts at the chosen time and stops at the chosen end time (so late starts and trailing chatter are skipped).
 * It also keeps track of how much of the replay is watched, so it can be recorded and replay badges can be handed out.
 */
export function RecordingPlayer({ recordingId, vimeoId, hash, start, end, title }: { recordingId: string; vimeoId: string; hash: string | null; start: number; end: number | null; title: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ended, setEnded] = useState(false);
  const [badges, setBadges] = useState<string[]>([]);
  const src = `https://player.vimeo.com/video/${vimeoId}?${hash ? `h=${hash}&` : ""}dnt=1&title=0&byline=0&portrait=0`;

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const player = new Player(el);
    let busy = false;
    let sent = 0;
    const note = (pct: number) => {
      const mark = [...MARKS].reverse().find((m) => pct >= m);
      if (!mark || mark <= sent) return;
      sent = mark;
      void recordView(recordingId, mark).then((r) => { if (r.new.length) setBadges(r.new); });
    };
    const onPlaying = () => note(1);
    player.on("play", onPlaying);
    player.on("ended", () => note(100));
    const onTime = async ({ seconds, duration }: { seconds: number; duration: number }) => {
      const last = end ?? duration;
      if (last > start) note(((seconds - start) / (last - start)) * 100);
      if (start === 0 && end === null) return;
      if (busy) return;
      if (seconds < start - 0.5) { busy = true; await jump(); busy = false; }
      else if (end !== null && seconds >= end) { busy = true; await player.pause(); setEnded(true); note(100); busy = false; }
    };
    const jump = async () => { try { await player.setCurrentTime(start); } catch { /* not ready yet */ } };
    if (start !== 0 || end !== null) void player.ready().then(jump);
    player.on("timeupdate", onTime);
    player.on("play", () => setEnded(false));
    return () => { player.off("timeupdate", onTime); player.off("play", onPlaying); void player.destroy(); };
  }, [start, end, recordingId]);

  return (
    <div className="rec-player">
      <iframe ref={frame} src={src} title={title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
      {ended ? <p className="when" role="status" style={{ marginTop: 8 }}>That is the end of the recording.</p> : null}
      {badges.length ? <BadgeToast keys={badges} onClose={() => setBadges([])} /> : null}
    </div>
  );
}
