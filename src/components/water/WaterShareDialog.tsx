"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { declineWaterShare, removeWaterShare, saveWaterShare } from "@/app/(app)/water-map/actions";

export type WaterMine = { place: string; prefilter: boolean; water_type: "city" | "well" } | null;

/**
 * The "Would you like to add yourself to the Water Share Map?" question, then the form.
 * `start="ask"` shows the policy messages first; `start="form"` goes straight to the form (editing).
 */
export function WaterShareDialog({ open, onClose, start, mine }: { open: boolean; onClose: () => void; start: "ask" | "form"; mine: WaterMine }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [step, setStep] = useState<"ask" | "form">(start);
  const [address, setAddress] = useState("");
  const [prefilter, setPrefilter] = useState<boolean | null>(mine ? mine.prefilter : null);
  const [water, setWater] = useState<string>(mine?.water_type ?? "");
  const [error, setError] = useState("");
  const [pending, run] = useTransition();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const done = () => { onClose(); router.refresh(); };
  const no = () => run(async () => { await declineWaterShare(); done(); });
  const save = () => run(async () => {
    setError("");
    const r = await saveWaterShare({ address, prefilter, waterType: water });
    if (r.ok) { setAddress(""); done(); } else setError(r.error);
  });
  const remove = () => run(async () => { const r = await removeWaterShare(); if (r.ok) done(); else setError(r.error); });

  return (
    <dialog ref={ref} className="rs-dialog ws-dlg" aria-labelledby="ws-title" onClose={onClose}>
      {step === "ask" ? (
        <>
          <h2 id="ws-title" className="qh" style={{ marginTop: 0 }}>Would you like to add yourself to the Water Share Map?</h2>
          <p><strong>Only add yourself if you are willing to share water with other community members&apos; leads.</strong></p>
          <p>Reminder that we have a strict policy on lead poaching. If anyone is found to be taking leads from other people while offering a water share, they will be removed from our community.</p>
          <p>We encourage the member making the sale to offer you compensation for sharing water, although this is not a requirement.</p>
          <div className="ws-actions">
            <button type="button" className="btn primary" onClick={() => setStep("form")}>Yes I want to be added to the Water Share Map</button>
            <button type="button" className="btn" disabled={pending} onClick={no}>No I do not want to be added</button>
          </div>
        </>
      ) : (
        <>
          <h2 id="ws-title" className="qh" style={{ marginTop: 0 }}>{mine ? "Your Water Share Map spot" : "Add yourself to the map"}</h2>
          {mine ? <p className="when">You are on the map near <strong>{mine.place}</strong>. To move your dot, type a new address. To keep it where it is, leave the address blank.</p> : null}
          <div className="field">
            <label htmlFor="ws-address">Address near you</label>
            <input id="ws-address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. the gas station or grocery store near your home" autoComplete="off" />
            <p className="when" style={{ margin: 0 }}>Please do not put your exact address for safety purposes. Choose an address nearby you such as a gas station or grocery store.</p>
          </div>
          <fieldset className="ws-choice">
            <legend>Do you have a prefilter?</legend>
            <label><input type="radio" name="ws-pre" checked={prefilter === true} onChange={() => setPrefilter(true)} /> Yes</label>
            <label><input type="radio" name="ws-pre" checked={prefilter === false} onChange={() => setPrefilter(false)} /> No</label>
          </fieldset>
          <fieldset className="ws-choice">
            <legend>Are you on city water or well water?</legend>
            <label><input type="radio" name="ws-water" checked={water === "city"} onChange={() => setWater("city")} /> City water</label>
            <label><input type="radio" name="ws-water" checked={water === "well"} onChange={() => setWater("well")} /> Well water</label>
          </fieldset>
          {error ? <p className="err" role="alert">{error}</p> : null}
          <div className="ws-actions">
            <button type="button" className="btn primary" disabled={pending || prefilter === null || !water} onClick={save}>{pending ? "Saving…" : mine ? "Save" : "Add me to the map"}</button>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            {mine ? <button type="button" className="linkbtn" disabled={pending} onClick={remove}>Remove me from the map</button> : null}
          </div>
        </>
      )}
    </dialog>
  );
}

/** Opens once per visit for an affiliate who has not answered yet. Closing it with Escape just asks again next visit. */
export function WaterPrompt() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem("flc_water_prompt") === "1"; } catch { /* ignore */ }
    if (!seen) queueMicrotask(() => setOpen(true));
  }, []);
  return <WaterShareDialog open={open} start="ask" mine={null} onClose={() => { setOpen(false); try { sessionStorage.setItem("flc_water_prompt", "1"); } catch { /* ignore */ } }} />;
}

/** The "you are on the map / add me" strip above the map. */
export function MyWaterEntry({ mine }: { mine: WaterMine }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="card-s ws-mine" aria-label="Your spot on the map">
      {mine ? (
        <p style={{ margin: 0 }}>You are on the map near <strong>{mine.place}</strong>. <button type="button" className="linkbtn" style={{ padding: 0 }} onClick={() => setOpen(true)}>Edit or remove</button></p>
      ) : (
        <p style={{ margin: 0 }}>You are not on the map. <button type="button" className="linkbtn" style={{ padding: 0 }} onClick={() => setOpen(true)}>Add me to the Water Share Map</button></p>
      )}
      <WaterShareDialog key={mine ? "edit" : "add"} open={open} onClose={() => setOpen(false)} start={mine ? "form" : "ask"} mine={mine} />
    </section>
  );
}
