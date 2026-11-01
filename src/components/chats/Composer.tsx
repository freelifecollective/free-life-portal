"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { VoiceRecorder } from "@/components/voice/VoiceRecorder";
import { createPost, postVoice, type ChatFormState } from "@/app/(app)/chats/actions";
import { POST_MAX } from "@/lib/chats/types";

export function Composer({ chatId, slug, placeholder }: { chatId: string; slug: string; placeholder: string }) {
  const [state, action, pending] = useActionState(createPost.bind(null, chatId, slug), { error: "" } as ChatFormState);
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [voiceError, setVoiceError] = useState("");
  useEffect(() => { if (state.sent) form.current?.reset(); }, [state.sent]);
  return (
    <form ref={form} action={action} className="composer card-s">
      <label className="sr-only" htmlFor="new-post">New post</label>
      <textarea id="new-post" name="body" rows={3} maxLength={POST_MAX} placeholder={placeholder} required />
      <div className="composer-row">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <VoiceRecorder onSend={async (url, secs) => { setVoiceError(""); const r = await postVoice(chatId, slug, url, secs); if (!r.ok) setVoiceError(r.error ?? "That did not work."); else router.refresh(); }} />
          <p className="err" role="alert" style={{ minHeight: 0, margin: 0 }}>{state.error || voiceError}</p>
        </span>
        <button className="btn primary small" type="submit" disabled={pending}>{pending ? "Posting…" : "Post"}</button>
      </div>
    </form>
  );
}
