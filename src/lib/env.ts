/**
 * Supabase is configured when both public variables are set. Without them the app runs in preview mode
 * (no real accounts; the profile lives in a cookie) so the flow can be seen before a project exists.
 * Preview mode is never active in production unless ALLOW_DEMO_MODE=1 is set deliberately.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const previewMode =
  !supabaseConfigured && (process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_MODE === "1");

/** Which segmentation engine to prefer: "auto" (model, then fallback), "model" or "fallback". */
export const CUTOUT_ENGINE = (process.env.NEXT_PUBLIC_CUTOUT_ENGINE ?? "auto") as "auto" | "model" | "fallback";

/** Where the segmentation model files are served from. Empty uses the model vendor's public CDN; set it to self-host. */
export const CUTOUT_MODEL_URL = process.env.NEXT_PUBLIC_CUTOUT_MODEL_URL ?? "";
