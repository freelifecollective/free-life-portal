"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveVideoChoice } from "@/app/(app)/advertising/landing-page/actions";

/** $33 and $47: choose between the video that comes with the account and the coach's video. Shown only when the coach has one. */
export function VideoChoice({ choice, coachName }: { choice: "standard" | "coach"; coachName: string }) {
  const router = useRouter();
  const [value, setValue] = useState(choice);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const pick = (v: "standard" | "coach") => {
    const before = value;
    setValue(v); setMsg(null);
    start(async () => {
      const r = await saveVideoChoice(v);
      if (r.ok) { setMsg({ ok: true, text: "Saved. Your page now plays this video." }); router.refresh(); }
      else { setValue(before); setMsg({ ok: false, text: r.error ?? "Something went wrong." }); }
    });
  };
  return (
    <div className="lpc-card lpc-choice" role="radiogroup" aria-labelledby="lpc-choice-h">
      <h2 id="lpc-choice-h" className="qh lpc-h">Which video plays on your page?</h2>
      <label className="lpc-radio"><input type="radio" name="video-choice" checked={value === "standard"} disabled={pending} onChange={() => pick("standard")} /> <span>The video that comes with your account</span></label>
      <label className="lpc-radio"><input type="radio" name="video-choice" checked={value === "coach"} disabled={pending} onChange={() => pick("coach")} /> <span>Your coach&apos;s video</span> <span translate="no">(<b>{coachName}</b>)</span></label>
      <p className={"status" + (msg ? (msg.ok ? " ok" : " bad") : "")} role="status">{msg?.text ?? ""}</p>
    </div>
  );
}
