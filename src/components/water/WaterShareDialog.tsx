"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { declineWaterShare, removeWaterShare, saveWaterShare, suggestPlaces } from "@/app/(app)/water-map/actions";

import type { Suggestion } from "@/lib/water/photon";
import type { Place } from "@/lib/water/types";

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
  const [chosen, setChosen] = useState<Place | null>(null);
  const [options, setOptions] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [looking, setLooking] = useState(false);
  const ticket = useRef(0);
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

  /** Wait for a pause in typing, then ask for choices. Answers that arrive late for an older word are ignored. */
  function type(v: string) {
    setAddress(v); setChosen(null); setActive(-1);
    const mine = ++ticket.current;
    if (v.trim().length < 3) { setOptions([]); setLooking(false); return; }
    setLooking(true);
    window.setTimeout(async () => {
      if (mine !== ticket.current) return;
      const r = await suggestPlaces(v);
      if (mine !== ticket.current) return;
      setOptions(r); setLooking(false);
    }, 300);
  }
  function pick(s: Suggestion) {
    ticket.current++;
    setAddress([s.title, s.detail].filter(Boolean).join(", "));
    setChosen(s.place); setOptions([]); setActive(-1); setLooking(false);
  }
  function keys(e: React.KeyboardEvent) {
    if (!options.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((active + 1) % options.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((active - 1 + options.length) % options.length); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(options[active]); }
    else if (e.key === "Escape") { e.stopPropagation(); setOptions([]); }
  }

  const done = () => { onClose(); router.refresh(); };
  const no = () => run(async () => { await declineWaterShare(); done(); });
  const save = () => run(async () => {
    setError("");
    const r = await saveWaterShare({ address, chosen, prefilter, waterType: water });
    if (r.ok) { setAddress(""); setChosen(null); done(); } else setError(r.error);
  });
  const remove = () => run(async () => { const r = await removeWaterShare(); if (r.ok) done(); else setError(r.error); });

  return (
    <dialog ref={ref} className="rs-dialog ws-dlg" aria-labelledby="ws-title" onClose={onClose}>
      {step === "ask" ? (
        <>
          <h2 id="ws-title" className="qh" style={{ marginTop: 0 }}>Would you like to add yourself to the Water Share Map?</h2>
          <p>Only add yourself if you are willing to share water with other community members&apos; leads.</p>
          <p className="ws-rank-note">Your rank will be shared on the map, so other members can see it when they tap your dot.</p>
          <p>Reminder that we have a strict policy on lead poaching. If anyone is found to be taking leads from other people while offering a water share, they will be removed from our community. We encourage the member making the sale to offer you compensation for sharing water, although <u>this is not a requirement</u>.</p>
          <div className="ws-actions">
            <button type="button" className="btn primary" onClick={() => setStep("form")}>Add Me to the Map</button>
            <button type="button" className="btn" disabled={pending} onClick={no}>No I do not want to be added</button>
          </div>
        </>
      ) : (
        <>
          <h2 id="ws-title" className="qh" style={{ marginTop: 0 }}>{mine ? "Your Water Share Map spot" : "Add yourself to the map"}</h2>
          {mine ? <p className="when">You are on the map near <strong>{mine.place}</strong>. To move your dot, type a new address. To keep it where it is, leave the address blank.</p> : null}
          <div className="field">
            <label htmlFor="ws-address">Address near you</label>
            <div className="ws-combo">
              <input id="ws-address" type="text" role="combobox" aria-expanded={options.length > 0} aria-controls="ws-options" aria-autocomplete="list" value={address} onChange={(e) => type(e.target.value)} onKeyDown={keys} placeholder="Start typing a store or address, e.g. Walmart Bowmanville" autoComplete="off" />
              {options.length ? (
                <ul id="ws-options" role="listbox" className="ws-options">
                  {options.map((o, i) => (
                    <li key={i} role="option" aria-selected={i === active} className={i === active ? "on" : undefined} onMouseDown={(e) => { e.preventDefault(); pick(o); }}>
                      <strong>{o.title}</strong>
                      <span>{o.detail}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {looking ? <p className="when" style={{ margin: 0 }}>Searching…</p> : chosen ? <p className="when" style={{ margin: 0 }}>✓ Place chosen. We will only show your town on the map.</p> : null}
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
            <button type="button" className="btn primary" disabled={pending || prefilter === null || !water} onClick={save}>{pending ? "Saving…" : mine ? "Save" : "Add Me to the Map"}</button>
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
