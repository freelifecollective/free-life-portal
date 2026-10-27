"use client";

import type { StepProps } from "../flow";

export function GoodStep({ f, go, goBack, save, saving }: StepProps & { save: () => void; saving: boolean }) {
  if (!f.pic) return null;
  const canAdjust = f.mode === "gen" && !!f.person && f.useCut && !!f.chosen;
  return (
    <section className="step final">
      <h1 className="page-heading" tabIndex={-1}>Lookin good!</h1>
      <p className="page-lede">Save a copy if you want to use it on your other accounts.</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="avatar-lg" src={f.pic.url} alt="Your new profile picture" />
      <div className="actions">
        {canAdjust ? <button className="btn" type="button" onClick={() => go("adjust")}>Reposition my picture</button> : null}
        <a className="btn" href={f.pic.url} download="free-life-profile-picture.jpg" style={{ textDecoration: "none" }}>Download picture</a>
        <button className="btn primary" type="button" disabled={saving} onClick={save}>{saving ? "Saving…" : "Done"}</button>
      </div>
      <p className="err" role="alert" style={{ textAlign: "center" }}>{f.saveError}</p>
      <div className="backrow">
        <button className="linkbtn" type="button" onClick={() => (f.mode === "gen" || f.mode === "avatar" ? go("gen") : goBack())}>Pick a different one</button>
      </div>
    </section>
  );
}
