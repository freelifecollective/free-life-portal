"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AttachButton } from "@/components/attach/AttachButton";
import { VoiceRecorder } from "@/components/voice/VoiceRecorder";
import { sendFileMessage, sendMessage, sendVoiceMessage, type MessageState } from "@/app/(app)/messages/actions";

export function MessageComposer({ otherId, draft = "" }: { otherId: string; draft?: string }) {
  const [state, action, pending] = useActionState(sendMessage.bind(null, otherId), { error: "" } as MessageState);
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [voiceError, setVoiceError] = useState("");
  useEffect(() => { if (state.sent) form.current?.reset(); }, [state.sent]);
  return (
    <form ref={form} action={action} className="composer card-s">
      <label className="sr-only" htmlFor="dm-body">Message</label>
      <textarea id="dm-body" name="body" rows={3} maxLength={4000} placeholder="Write a message…" defaultValue={draft} required />
      <div className="composer-row">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <AttachButton onPick={async (a) => { setVoiceError(""); const r = await sendFileMessage(otherId, a); if (!r.ok) setVoiceError(r.error ?? "That did not work."); else router.refresh(); }} />
          <VoiceRecorder onSend={async (url, secs) => { setVoiceError(""); const r = await sendVoiceMessage(otherId, url, secs); if (!r.ok) setVoiceError(r.error ?? "That did not work."); else router.refresh(); }} />
          <p className="err" role="alert" style={{ minHeight: 0, margin: 0 }}>{state.error || voiceError}</p>
        </span>
        <button className="btn primary small" type="submit" disabled={pending}>{pending ? "Sending…" : "Send"}</button>
      </div>
    </form>
  );
}
