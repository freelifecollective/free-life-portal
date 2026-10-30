import type { Spec, StyleChoice } from "@/lib/avatar/palettes";
import type { RenderContext } from "@/lib/avatar/render";
import type { AvatarKind } from "@/lib/profile/types";

export type StepId = "name" | "username" | "instagram" | "birthday" | "picture" | "frame" | "style" | "gen" | "touch" | "adjust" | "good" | "done";

/** Which of the four progress dots a step belongs to (4 = all done). */
export const DOT_OF: Record<StepId, number> = {
  name: 0, username: 1, instagram: 2, birthday: 2, picture: 3, frame: 3, style: 3, gen: 3, touch: 3, adjust: 3, good: 3, done: 4,
};

export type PhotoMode = "own" | "gen" | "avatar" | "";
export type Photo = { img: CanvasImageSource; w: number; h: number };
export type Crop = { z: number; zmin: number; ox: number; oy: number };
/** the chosen picture: a data URL to show, and the 1024px canvas to upload */
export type Pic = { url: string; canvas: HTMLCanvasElement };

export type Flow = {
  first: string; last: string; username: string; /** the name the username was suggested for */ usernameFor: string; ig: string; fb: string; fbSame: boolean; igTouched: boolean;
  /** optional birthday, as the strings in the dropdowns */ bMonth: string; bDay: string; bYear: string;
  mode: PhotoMode;
  photo: Photo | null;
  crop: Crop;
  /** square 1024px crop of the photo */
  src: HTMLCanvasElement | null;
  /** person with transparent background, and the editable mask behind it */
  person: HTMLCanvasElement | null;
  alpha: HTMLCanvasElement | null;
  alpha0: HTMLCanvasElement | null;
  useCut: boolean;
  styleNote: string;
  style: StyleChoice;
  batches: Spec[][];
  bi: number;
  chosen: Spec | null;
  pic: Pic | null;
  saveError: string;
};

export function freshFlow(): Flow {
  return {
    first: "", last: "", username: "", usernameFor: "", ig: "", fb: "", fbSame: false, igTouched: false, bMonth: "", bDay: "", bYear: "",
    mode: "", photo: null, crop: { z: 1, zmin: 1, ox: 0, oy: 0 }, src: null, person: null, alpha: null, alpha0: null,
    useCut: true, styleNote: "", style: { outline: null, bg: null }, batches: [], bi: 0, chosen: null, pic: null, saveError: "",
  };
}

export type Env = { mode: "supabase" | "preview"; userId: string };

export type StepProps = {
  f: Flow;
  set: (patch: Partial<Flow> | ((f: Flow) => Partial<Flow>)) => void;
  go: (id: StepId) => void;
  goBack: () => void;
  env: Env;
};

export const KIND_OF: Record<Exclude<PhotoMode, "">, AvatarKind> = { own: "upload", gen: "generated", avatar: "monogram" };

export function initials(f: Pick<Flow, "first" | "last">): string {
  return ((f.first || "").charAt(0) + (f.last || "").charAt(0)).toUpperCase() || "?";
}

/** Playfair Display as the browser loaded it (next/font gives it a generated family name). */
export function displayFont(): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--font-playfair").trim();
  return v || "Georgia, serif";
}
export async function ensureDisplayFont(): Promise<string> {
  const fam = displayFont();
  try {
    if (document.fonts?.load) {
      await Promise.race([
        Promise.all([document.fonts.load(`600 40px ${fam}`), document.fonts.load(`italic 600 40px ${fam}`)]),
        new Promise((r) => setTimeout(r, 1500)),
      ]);
    }
  } catch { /* fall back to the system serif */ }
  return fam;
}

export function renderCtx(f: Flow, font: string): RenderContext {
  return { mode: f.mode === "" ? "own" : f.mode, useCut: f.useCut, person: f.person, src: f.src, initials: initials(f), displayFont: font };
}

export function makePic(c: HTMLCanvasElement, quality = 0.92): Pic {
  return { url: c.toDataURL("image/jpeg", quality), canvas: c };
}

export function canvasToBlob(c: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Could not export the picture"))), "image/jpeg", quality));
}
