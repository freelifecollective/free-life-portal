"use client";

import { HANDLE_MESSAGES, cleanHandle, handleState } from "@/lib/handles";
import type { StepProps } from "../flow";

export function SocialStep({ f, set, go }: StepProps) {
  const igState = handleState(f.ig, "instagram");
  const fbValue = f.fbSame ? f.ig : f.fb;
  const fbState = handleState(fbValue, "facebook");
  const canContinue = igState !== "bad" && fbState !== "bad" && (igState === "ok" || fbState === "ok");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canContinue) return;
    set({ ig: igState === "ok" ? cleanHandle(f.ig, "instagram") : "", fb: fbState === "ok" ? cleanHandle(fbValue, "facebook") : "", fbSame: f.fbSame });
    go("picture");
  }
  function skip() {
    set({ ig: "", fb: "", fbSame: false, igTouched: true });
    go("picture");
  }
  const tidy = (net: "instagram" | "facebook") => {
    if (net === "instagram" && igState === "ok") set({ ig: cleanHandle(f.ig, "instagram") });
    if (net === "facebook" && !f.fbSame && fbState === "ok") set({ fb: cleanHandle(f.fb, "facebook") });
  };

  return (
    <section className="step">
      <h1 className="page-heading" tabIndex={-1}>Let&rsquo;s get your social media handles</h1>
      <p className="page-lede" style={{ maxWidth: "none" }}>Optional. These will be added to your landing page we&rsquo;ll create for you later on!</p>
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="ig">Instagram handle</label>
          <div className="handle"><span className="at">@</span>
            <input id="ig" type="text" autoComplete="off" autoCapitalize="off" spellCheck={false} inputMode="url" value={f.ig}
              onChange={(e) => set({ ig: e.target.value, igTouched: true })} onBlur={() => tidy("instagram")} /></div>
        </div>
        <p className={"status" + (igState === "ok" ? " ok" : igState === "bad" ? " bad" : "")} aria-live="polite">
          {igState === "ok" ? "Looks good" : igState === "bad" ? HANDLE_MESSAGES.instagram : ""}
        </p>
        <label className="check">
          <input type="checkbox" checked={f.fbSame} onChange={(e) => set({ fbSame: e.target.checked })} />
          <span>My Facebook handle is the same as my Instagram handle</span>
        </label>
        <div className="field">
          <label htmlFor="fb">Facebook handle</label>
          <div className="handle"><span className="at">@</span>
            <input id="fb" type="text" autoComplete="off" autoCapitalize="off" spellCheck={false} inputMode="url" disabled={f.fbSame}
              value={fbValue} onChange={(e) => set({ fb: e.target.value })} onBlur={() => tidy("facebook")} /></div>
        </div>
        <p className={"status" + (fbState === "ok" ? " ok" : fbState === "bad" ? " bad" : "")} aria-live="polite">
          {fbState === "ok" ? "Looks good" : fbState === "bad" ? HANDLE_MESSAGES.facebook : ""}
        </p>
        <div className="actions">
          <button className="btn primary" disabled={!canContinue} type="submit">Continue</button>
          <button className="linkbtn" type="button" onClick={skip}>Don&rsquo;t worry, you can enter these later</button>
        </div>
      </form>
    </section>
  );
}
