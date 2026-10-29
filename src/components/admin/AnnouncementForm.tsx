"use client";

import { useActionState, useEffect, useRef } from "react";
import { postAnnouncement, type AnnouncementState } from "@/app/(app)/admin/announcements/actions";

export function AnnouncementForm() {
  const [state, action, pending] = useActionState(postAnnouncement, { error: "" } as AnnouncementState);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.sent) form.current?.reset(); }, [state]);
  return (
    <form ref={form} action={action} className="set-form card-s">
      <h2 className="qh" style={{ margin: 0 }}>New announcement</h2>
      <div className="field"><label htmlFor="a-t">Title</label><input id="a-t" name="title" type="text" required maxLength={120} placeholder="New: Outsourcing is here!" /></div>
      <div className="field"><label htmlFor="a-b">Message (optional)</label><textarea id="a-b" name="body" rows={3} maxLength={400} /></div>
      <div className="field"><label htmlFor="a-u">Open this page when tapped (optional)</label><input id="a-u" name="url" type="text" placeholder="/financing" autoCapitalize="none" /></div>
      <div className="set-actions">
        <button className="btn primary" type="submit" disabled={pending}>{pending ? "Sending…" : "Send to everyone"}</button>
        <span role="status" className="when">{state.sent ? "Sent." : ""}</span>
      </div>
      <p className="err" role="alert">{state.error}</p>
    </form>
  );
}
