"use client";

import { useEffect, useRef } from "react";

/** Shown when someone arrives from "Message Sonya" on the cancel-subscription popup. */
export function CloseAccountNotice() {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = dialog.current; if (d && !d.open) d.showModal(); }, []);
  return (
    <dialog ref={dialog} className="rs-dialog" aria-labelledby="close-title">
      <h2 id="close-title" className="qh" style={{ marginTop: 0 }}>Before you ask to close your account</h2>
      <p>Go to your [LEADS] section and download all of your leads before requesting your account to be closed. Once your account is closed, all of your lead data will be deleted and cannot be recovered.</p>
      <div className="dlg-actions"><button className="btn primary" type="button" onClick={() => dialog.current?.close()}>OK</button></div>
    </dialog>
  );
}
