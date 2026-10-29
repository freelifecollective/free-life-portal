"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendMessage, type MessageState } from "@/app/(app)/messages/actions";

export function MessageComposer({ otherId }: { otherId: string }) {
  const [state, action, pending] = useActionState(sendMessage.bind(null, otherId), { error: "" } as MessageState);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.sent) form.current?.reset(); }, [state.sent]);
  return (
    <form ref={form} action={action} className="composer card-s">
      <label className="sr-only" htmlFor="dm-body">Message</label>
      <textarea id="dm-body" name="body" rows={3} maxLength={4000} placeholder="Write a message…" required />
      <div className="composer-row">
        <p className="err" role="alert" style={{ minHeight: 0, margin: 0 }}>{state.error}</p>
        <button className="btn primary small" type="submit" disabled={pending}>{pending ? "Sending…" : "Send"}</button>
      </div>
    </form>
  );
}
