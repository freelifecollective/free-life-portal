"use client";

/** A voice note you can play. */
export function VoiceNote({ src, secs }: { src: string; secs?: number | null }) {
  return (
    <span className="vn">
      <audio controls preload="metadata" src={src} aria-label="Voice note" />
      {secs ? <small className="when">{`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`}</small> : null}
    </span>
  );
}
