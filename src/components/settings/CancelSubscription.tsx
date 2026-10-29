"use client";

import Link from "next/link";
import { useRef } from "react";

export function CancelSubscription() {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <div>
      <button className="btn" type="button" onClick={() => dialog.current?.showModal()}>Cancel subscription</button>
      <dialog ref={dialog} className="rs-dialog" aria-labelledby="cancel-title">
        <h2 id="cancel-title" className="qh" style={{ marginTop: 0 }}>Cancel your subscription</h2>
        <p>To cancel, please reach out to <strong>@sonyafruthven</strong> or send an email to <a href="mailto:freelifeplatform11@gmail.com">freelifeplatform11@gmail.com</a> to have your account closed. By doing this, you will be removed from the platform.</p>
        <div className="dlg-actions">
          <button className="btn" type="button" onClick={() => dialog.current?.close()}>Close</button>
          <Link className="btn primary" href="/messages/sonyafruthven?notice=close" style={{ textDecoration: "none" }}>Message Sonya</Link>
        </div>
      </dialog>
    </div>
  );
}
