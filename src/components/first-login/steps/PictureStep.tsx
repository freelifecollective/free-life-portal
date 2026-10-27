"use client";

import { useRef, useState } from "react";
import { ensureDisplayFont, type Crop, type Photo, type StepProps } from "../flow";

const MAX_BYTES = 15 * 1024 * 1024;
export const CROP_V = 720;

/** EXIF-aware decode, with an <img> fallback for older browsers. */
export async function decodeImage(file: File): Promise<Photo> {
  try {
    if ("createImageBitmap" in window) {
      const b = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { img: b, w: b.width, h: b.height };
    }
  } catch { /* fall through to <img> */ }
  const url = URL.createObjectURL(file);
  try {
    const im = new Image();
    await new Promise<void>((res, rej) => { im.onload = () => res(); im.onerror = () => rej(new Error("decode")); im.src = url; });
    return { img: im, w: im.naturalWidth, h: im.naturalHeight };
  } finally { URL.revokeObjectURL(url); }
}

export function initialCrop(p: Photo): Crop {
  const zmin = CROP_V / Math.min(p.w, p.h);
  const dw = p.w * zmin, dh = p.h * zmin;
  const ox = (CROP_V - dw) / 2;
  const oy = p.h > p.w ? -(dh - CROP_V) * 0.3 : (CROP_V - dh) / 2;
  return { z: zmin, zmin, ox, oy };
}

/** Pick a photo for the given mode. Shared by the picture step and the "use a different photo" link. */
export function usePhotoPicker({ set, go }: Pick<StepProps, "set" | "go">, onError: (m: string) => void) {
  const input = useRef<HTMLInputElement>(null);
  const modeRef = useRef<"own" | "gen">("own");
  const open = (mode: "own" | "gen") => { modeRef.current = mode; onError(""); input.current?.click(); };
  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\//.test(file.type)) return onError("That file is not an image. Try a JPG or PNG.");
    if (file.size > MAX_BYTES) return onError("That photo is over 15 MB. Try a smaller one.");
    try {
      const photo = await decodeImage(file);
      set({ photo, mode: modeRef.current, crop: initialCrop(photo), person: null, alpha: null, alpha0: null, src: null, useCut: true });
      go("frame");
    } catch { onError("We could not read that photo. Try a JPG or PNG."); }
  };
  const field = <input ref={input} type="file" accept="image/*" hidden onChange={onChange} data-testid="photo-input" />;
  return { open, field };
}

export function PictureStep(props: StepProps) {
  const { set, go } = props;
  const [err, setErr] = useState("");
  const picker = usePhotoPicker(props, setErr);

  async function avatar() {
    set({ mode: "avatar", person: null, useCut: false, src: null, styleNote: "" });
    setErr("");
    await ensureDisplayFont();
    go("style");
  }

  return (
    <section className="step">
      <h1 className="page-heading" tabIndex={-1}>Add your profile picture</h1>
      <p className="page-lede">Upload one of your own, let the profile generator style a set of options from your photo, or create an avatar if you&rsquo;re not ready to share your face yet.</p>
      <div className="choices">
        <button className="choice" type="button" onClick={() => picker.open("own")}><strong>Upload my own picture</strong><span>Use a photo you already love.</span></button>
        <button className="choice" type="button" onClick={() => picker.open("gen")}><strong>Use the profile generator</strong><span>We remove the background and place you on 10 designed backdrops.</span></button>
        <button className="choice" type="button" onClick={avatar}><strong>Create an avatar instead</strong><span>Not ready to share your face yet? Use your initials on a designed backdrop.</span></button>
      </div>
      <p className="err" role="alert">{err}</p>
      {picker.field}
    </section>
  );
}
