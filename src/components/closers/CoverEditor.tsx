"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { saveMyCard, type ApplyState } from "@/app/(app)/call-closers/actions";
import { CoverFields } from "./CoverFields";
import type { CloserCardData } from "@/lib/closers/types";

/** A call closer changes their own cover card. */
export function CoverEditor({ c }: { c: CloserCardData }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [state, action, pending] = useActionState(saveMyCard, { error: "" } as ApplyState);
  useEffect(() => { if (state.sent) { dlg.current?.close(); router.refresh(); } }, [state, router]);
  return (
    <>
      <button type="button" className="linkbtn cc-edit" onClick={() => dlg.current?.showModal()}>Edit my cover card</button>
      <dialog ref={dlg} className="rs-dialog" aria-label="Edit my cover card" onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}>
        <form action={action} className="set-form">
          <h2 className="qh" style={{ margin: 0 }}>Edit my cover card</h2>
          <CoverFields idPrefix={`ce-${c.id}`} initial={{ cover_url: c.cover_url ?? "", location: c.location ?? "", experience_text: c.experience_text ?? "", bio: c.bio ?? "" }} />
          <p className="err" role="alert" style={{ minHeight: 0 }}>{state.error}</p>
          <div className="dlg-actions"><button className="btn" type="button" onClick={() => dlg.current?.close()}>Cancel</button><button className="btn primary" type="submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button></div>
        </form>
      </dialog>
    </>
  );
}
