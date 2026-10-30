"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmBuddyRank, setBuddyStatus } from "@/app/(app)/buddy/actions";
import { RANKS } from "@/lib/buddy/questions";
import { celebrateRankUp } from "@/lib/celebrate";

/**
 * "Are you still a 4A?" Used when someone comes back to find a new buddy ("return"),
 * and as the 4-month reminder ("remind"), which adds two ways to leave the pool.
 * 6A+ is the top rank, so those members are never asked about their rank.
 */
export function BuddyDialog({ kind, rank, open, onClose }: { kind: "return" | "remind"; rank: string; open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const top = rank === "6A+";

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const finish = (msg: string) => { setNote(msg); onClose(); router.refresh(); };
  const stay = () => start(async () => { const r = await setBuddyStatus("in_pool"); if (r.ok) finish("Saved. You are back in the pool."); });
  const setRank = (r: string) => start(async () => { const res = await confirmBuddyRank(RANKS.indexOf(r as (typeof RANKS)[number]) + 1); if (res.ok) { if (res.rankUp) celebrateRankUp(res.rankUp); finish("Saved. Your rank is updated and you are back in the pool."); } });
  const leave = (s: "paused" | "has_ab") => start(async () => { const r = await setBuddyStatus(s); if (r.ok) finish("Saved. You are out of the pool and will not see this popup."); });
  const confirmRank = () => start(async () => { const res = await confirmBuddyRank(RANKS.indexOf(rank as (typeof RANKS)[number]) + 1); if (res.ok) finish("Saved. You are back in the pool."); });

  return (
    <>
      <dialog ref={ref} className="rs-dialog bq-dlg" aria-labelledby="bd-title" onClose={onClose}>
        <button type="button" className="bq-x" aria-label="Close" onClick={onClose}>×</button>
        <h2 id="bd-title" className="qh" style={{ marginTop: 0 }}>{top ? "Are you still looking for an AB?" : `Are you still a ${rank}?`}</h2>
        <button type="button" className="btn primary" disabled={pending} onClick={top ? stay : confirmRank}>{top ? "Yes, I'm still looking" : `Yes I'm still a ${rank}`}</button>
        {!top ? (
          <>
            <p className="bq-no">No - I need to update my rank</p>
            <div className="bq-chips">{RANKS.filter((r) => r !== rank).map((r) => <button key={r} type="button" className="bq-chip" disabled={pending} onClick={() => setRank(r)}>{r}</button>)}</div>
          </>
        ) : null}
        {kind === "remind" ? (
          <div className="bq-pills">
            <button type="button" className="bq-pill" disabled={pending} onClick={() => leave("paused")}>I am not currently looking for an AB</button>
            <button type="button" className="bq-pill" disabled={pending} onClick={() => leave("has_ab")}>I already have an AB</button>
          </div>
        ) : null}
      </dialog>
      <p role="status" className="when">{note}</p>
    </>
  );
}

/** The 4-month reminder. Shows once per visit until they answer, match or leave the pool. */
export function BuddyReminder({ rank }: { rank: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem("flc_buddy_remind") === "1"; } catch { /* ignore */ }
    if (!seen) queueMicrotask(() => setOpen(true));
  }, []);
  return <BuddyDialog kind="remind" rank={rank} open={open} onClose={() => { setOpen(false); try { sessionStorage.setItem("flc_buddy_remind", "1"); } catch { /* ignore */ } }} />;
}
