"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveProfileAction } from "@/app/welcome/actions";
import { PREVIEW_AVATAR_KEY } from "@/components/Avatar";
import { renderAvatar } from "@/lib/avatar/render";
import { composePerson } from "@/lib/cutout";
import { createClient } from "@/lib/supabase/client";
import {
  DOT_OF, KIND_OF, canvasToBlob, displayFont, freshFlow, makePic, renderCtx,
  type Env, type Flow, type StepId, type StepProps,
} from "./flow";
import "./first-login.css";
import { AdjustStep } from "./steps/AdjustStep";
import { DoneStep } from "./steps/DoneStep";
import { FrameStep } from "./steps/FrameStep";
import { GenStep } from "./steps/GenStep";
import { GoodStep } from "./steps/GoodStep";
import { NameStep } from "./steps/NameStep";
import { PictureStep } from "./steps/PictureStep";
import { SocialStep } from "./steps/SocialStep";
import { StyleStep } from "./steps/StyleStep";
import { TouchStep } from "./steps/TouchStep";
import { UsernameStep } from "./steps/UsernameStep";
import { Welcome } from "./Welcome";

const KEEP = "flc_welcome";
const INTRO_SEEN = "flc_intro_seen";
type Saved = Pick<Flow, "first" | "last" | "username" | "usernameFor" | "ig" | "fb" | "fbSame" | "igTouched">;

export function FirstLogin({ env, alreadyOnboarded }: { env: Env; alreadyOnboarded: boolean }) {
  const router = useRouter();
  /* only the value at first load counts: saving flips it, and the flow must not jump away mid-way */
  const [wasOnboarded] = useState(alreadyOnboarded);
  const [f, setF] = useState<Flow>(freshFlow);
  const fRef = useRef(f);
  useEffect(() => { fRef.current = f; });
  const [step, setStep] = useState<StepId | null>(null);
  const stepRef = useRef<StepId | null>(null);
  const hist = useRef<StepId[]>([]);
  const [canBack, setCanBack] = useState(false);
  const [intro, setIntro] = useState<"pending" | "playing" | "done">("pending");
  const [fade, setFade] = useState(false);
  const [saving, setSaving] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const set = useCallback<StepProps["set"]>((patch) => setF((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) })), []);

  /** Move to a step. Leaving the touch-up or reposition screens applies what was done there. */
  const move = useCallback((id: StepId, back: boolean) => {
    const cur = stepRef.current;
    const s = fRef.current;
    if (cur === "touch" && id !== "touch" && s.alpha && s.src) setF((x) => ({ ...x, person: composePerson(s.src!, s.alpha!) }));
    if (cur === "adjust" && id !== "adjust" && s.chosen) setF((x) => ({ ...x, pic: makePic(renderAvatar(s.chosen!, 1024, renderCtx(s, displayFont()))) }));
    if (!back && cur && cur !== id) hist.current.push(cur);
    stepRef.current = id;
    setStep(id);
    setCanBack(hist.current.length > 0);
    window.scrollTo(0, 0);
  }, []);
  const go = useCallback((id: StepId) => move(id, false), [move]);
  const goBack = useCallback(() => {
    const prev = hist.current.pop();
    if (prev) move(prev, true);
  }, [move]);

  /* start: restore typed answers, then play the intro once per visit */
  useEffect(() => {
    if (wasOnboarded) { router.replace("/"); return; }
    queueMicrotask(() => {
      try {
        const saved = JSON.parse(sessionStorage.getItem(KEEP) ?? "null") as Partial<Saved> | null;
        if (saved) setF((s) => ({ ...s, ...saved }));
      } catch { /* storage may be blocked */ }
      let seen = false;
      try { seen = sessionStorage.getItem(INTRO_SEEN) === "1"; } catch { /* ignore */ }
      if (seen) { setIntro("done"); move("name", false); } else setIntro("playing");
    });
  }, [move, router, wasOnboarded]);

  /* keep typed answers if the page is refreshed */
  useEffect(() => {
    const keep: Saved = { first: f.first, last: f.last, username: f.username, usernameFor: f.usernameFor, ig: f.ig, fb: f.fb, fbSame: f.fbSame, igTouched: f.igTouched };
    try { if (step !== "done") sessionStorage.setItem(KEEP, JSON.stringify(keep)); } catch { /* ignore */ }
  }, [f.first, f.last, f.username, f.usernameFor, f.ig, f.fb, f.fbSame, f.igTouched, step]);

  /* focus: first text field of the new step, or its heading */
  useEffect(() => {
    if (!step) return;
    const el = root.current?.querySelector<HTMLElement>(".step input[type=text], .step h1");
    try { el?.focus({ preventScroll: true }); } catch { el?.focus(); }
  }, [step]);

  async function save() {
    const s = fRef.current;
    if (!s.pic || !s.mode) return;
    setSaving(true);
    set({ saveError: "" });
    try {
      let avatarUrl: string | null = null;
      if (env.mode === "supabase") {
        const supabase = createClient();
        const path = `${env.userId}/avatar.jpg`;
        const { error } = await supabase.storage.from("avatars").upload(path, await canvasToBlob(s.pic.canvas), { upsert: true, contentType: "image/jpeg", cacheControl: "3600" });
        if (error) throw error;
        avatarUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl + `?v=${Date.now()}`;
      } else {
        try { localStorage.setItem(PREVIEW_AVATAR_KEY, s.pic.url); } catch { /* picture just will not show in the shell */ }
      }
      const r = await saveProfileAction({
        first: s.first, last: s.last, username: s.username, instagram: s.ig, facebook: s.fb,
        avatarKind: KIND_OF[s.mode], avatarUrl,
      });
      if (!r.ok) {
        set({ saveError: r.error });
        if (r.field === "username") go("username");
        else if (r.field === "name") go("name");
        else if (r.field === "instagram" || r.field === "facebook") go("instagram");
        return;
      }
      try { sessionStorage.removeItem(KEEP); } catch { /* ignore */ }
      go("done");
    } catch {
      set({ saveError: "We couldn't upload your picture. Please check your connection and try again." });
    } finally { setSaving(false); }
  }

  if (wasOnboarded) return null;
  const p: StepProps = { f, set, go, goBack, env };
  const dots = step ? DOT_OF[step] : 0;

  return (
    <div className="fl" ref={root}>
      <header className="top">
        <div className="topl">
          {canBack && step !== "done" ? (
            <button className="backbtn" type="button" aria-label="Go back" onClick={goBack}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
            </button>
          ) : null}
          <div className="brand">Free Life Collective</div>
        </div>
        <div className="dots" role="img" aria-label={`Step ${Math.min(dots + 1, 4)} of 4`}>
          {[0, 1, 2, 3].map((i) => <i key={i} className={i <= dots ? "on" : ""} />)}
        </div>
      </header>
      <main>
        {step === "name" && <NameStep {...p} fade={fade} />}
        {step === "username" && <UsernameStep {...p} />}
        {step === "instagram" && <SocialStep {...p} />}
        {step === "picture" && <PictureStep {...p} />}
        {step === "frame" && <FrameStep {...p} />}
        {step === "style" && <StyleStep {...p} />}
        {step === "gen" && <GenStep {...p} />}
        {step === "touch" && <TouchStep {...p} />}
        {step === "adjust" && <AdjustStep {...p} />}
        {step === "good" && <GoodStep {...p} save={save} saving={saving} />}
        {step === "done" && <DoneStep f={f} env={env} />}
      </main>
      {intro === "playing" ? (
        <Welcome
          onReveal={() => { setFade(true); move("name", false); }}
          onFinish={() => { setIntro("done"); try { sessionStorage.setItem(INTRO_SEEN, "1"); } catch { /* ignore */ } setTimeout(() => setFade(false), 2100); }}
        />
      ) : null}
    </div>
  );
}
