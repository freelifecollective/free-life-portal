"use client";

import { CountrySelect } from "@/components/CountrySelect";
import type { StepProps } from "../flow";

/** Where do you live? It starts the Earnings Estimator on the right country. Optional. */
export function CountryStep({ f, set, go }: StepProps) {
  return (
    <section className="step">
      <h1 className="page-heading" tabIndex={-1}>Where do you live?</h1>
      <p className="page-lede" style={{ maxWidth: "none" }}>This will be used to customize certain settings in your account.</p>
      <form onSubmit={(e) => { e.preventDefault(); go("picture"); }} noValidate>
        <div className="field">
          <label htmlFor="cn-country">Country</label>
          <CountrySelect id="cn-country" value={f.country} onChange={(country) => set({ country })} />
        </div>
        <div className="actions">
          <button className="btn primary" type="submit">Continue</button>
          <button className="linkbtn" type="button" onClick={() => { set({ country: "" }); go("picture"); }}>Skip, I&rsquo;ll add it later</button>
        </div>
      </form>
    </section>
  );
}
