/*
 * A funnel page, built the way ClickFunnels builds them: sections hold rows, rows hold 1 to 4 columns, columns hold elements.
 * Everything is plain data. Pages never hold HTML: text is text, links and colours are checked (sanitizePage) before saving.
 */

export type Shadow = "none" | "sm" | "md" | "lg";
export type Align = "left" | "center" | "right";

export type Style = {
  /** top, right, bottom, left, in pixels */
  padding?: [number, number, number, number];
  margin?: [number, number, number, number];
  background?: string;
  backgroundImage?: string;
  color?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  italic?: boolean;
  uppercase?: boolean;
  align?: Align;
  radius?: number;
  shadow?: Shadow;
  borderWidth?: number;
  borderColor?: string;
  /** a section's or element's widest size, in pixels */
  maxWidth?: number;
};

export type ElementType = "headline" | "subheadline" | "text" | "image" | "video" | "button" | "form" | "list" | "divider" | "spacer";
export const ELEMENT_TYPES: ElementType[] = ["headline", "subheadline", "text", "image", "video", "button", "form", "list", "divider", "spacer"];

export type ButtonAction = "next" | "url" | "step";
export type FormField = "first_name" | "last_name" | "email" | "phone";

export type Props = {
  text?: string;
  /** button: second, smaller line */
  subtext?: string;
  /** image */
  src?: string;
  alt?: string;
  /** video: Vimeo or YouTube player address */
  video?: string;
  /** button */
  action?: ButtonAction;
  href?: string;
  step?: string;
  /** form */
  fields?: FormField[];
  buttonText?: string;
  /** list */
  items?: string[];
  /** spacer and divider */
  height?: number;
  /** button and form button colours */
  buttonColor?: string;
  buttonTextColor?: string;
};

export type El = { id: string; type: ElementType; props: Props; style: Style };
export type Column = { id: string; style: Style; elements: El[] };
export type Row = { id: string; style: Style; columns: Column[] };
export type Section = { id: string; style: Style; rows: Row[] };
export type PageSettings = { title?: string; background?: string; fontFamily?: string; color?: string };
export type Page = { version: 1; settings: PageSettings; sections: Section[] };

export const FONTS = ["Playfair Display", "Lato", "Raleway", "Montserrat", "Open Sans", "Poppins", "Roboto", "Merriweather", "Georgia", "Arial"] as const;
export const SHADOWS: Record<Shadow, string> = { none: "none", sm: "0 1px 3px rgba(0,0,0,.12)", md: "0 6px 18px rgba(0,0,0,.14)", lg: "0 16px 40px rgba(0,0,0,.2)" };
export const FIELD_LABELS: Record<FormField, string> = { first_name: "First name", last_name: "Last name", email: "Email", phone: "Phone" };

export const ELEMENT_LABELS: Record<ElementType, string> = {
  headline: "Headline", subheadline: "Sub-headline", text: "Paragraph", image: "Image", video: "Video",
  button: "Button", form: "Form", list: "Bullet list", divider: "Divider", spacer: "Spacer",
};

/* ------------------------------------------------------------------ new pieces */

export const newId = () => Math.random().toString(36).slice(2, 10);

export function newElement(type: ElementType): El {
  const id = newId();
  switch (type) {
    case "headline": return { id, type, props: { text: "Your headline goes here" }, style: { fontSize: 44, fontWeight: 700, align: "center", fontFamily: "Playfair Display", padding: [10, 0, 10, 0] } };
    case "subheadline": return { id, type, props: { text: "A sub-headline that explains the promise" }, style: { fontSize: 24, fontWeight: 400, align: "center", padding: [6, 0, 6, 0] } };
    case "text": return { id, type, props: { text: "Write your paragraph here. Click to change the words." }, style: { fontSize: 18, lineHeight: 1.6, align: "left", padding: [6, 0, 6, 0] } };
    case "image": return { id, type, props: { src: "", alt: "" }, style: { align: "center", radius: 8, padding: [6, 0, 6, 0] } };
    case "video": return { id, type, props: { video: "" }, style: { radius: 8, padding: [6, 0, 6, 0] } };
    case "button": return { id, type, props: { text: "Yes, I want this!", subtext: "", action: "next", buttonColor: "#8C6F5E", buttonTextColor: "#FFFFFF" }, style: { align: "center", fontSize: 20, fontWeight: 700, radius: 10, padding: [10, 0, 10, 0] } };
    case "form": return { id, type, props: { fields: ["first_name", "email"], buttonText: "Send it to me", buttonColor: "#8C6F5E", buttonTextColor: "#FFFFFF" }, style: { padding: [10, 0, 10, 0], maxWidth: 520, align: "center" } };
    case "list": return { id, type, props: { items: ["First benefit", "Second benefit", "Third benefit"] }, style: { fontSize: 18, padding: [6, 0, 6, 0] } };
    case "divider": return { id, type, props: { height: 1 }, style: { color: "#E4DED6", padding: [12, 0, 12, 0] } };
    case "spacer": return { id, type, props: { height: 40 }, style: {} };
  }
}

export const newColumn = (elements: El[] = []): Column => ({ id: newId(), style: {}, elements });
export const newRow = (columns = 1): Row => ({ id: newId(), style: { maxWidth: 1000 }, columns: Array.from({ length: columns }, () => newColumn()) });
export const newSection = (): Section => ({ id: newId(), style: { padding: [48, 20, 48, 20] }, rows: [newRow(1)] });
export const emptyPage = (): Page => ({ version: 1, settings: { background: "#FFFFFF", fontFamily: "Lato", color: "#2F2A26" }, sections: [newSection()] });

/** A ready-made opt-in page, much like the standard landing page, to start from. */
export function optInPage(): Page {
  const hero = newSection();
  hero.style = { padding: [64, 20, 64, 20], background: "#F6F5F1" };
  const h = newElement("headline"); h.props.text = "You already know something has to shift.";
  const s = newElement("subheadline"); s.props.text = "Watch the free video to see the simple framework, part-time and from your phone.";
  const v = newElement("video");
  const f = newElement("form");
  hero.rows[0].columns[0].elements = [h, s, v, f];
  return { version: 1, settings: { background: "#FFFFFF", fontFamily: "Lato", color: "#2F2A26" }, sections: [hero] };
}

/** A simple thank-you page. */
export function thankYouPage(): Page {
  const sec = newSection();
  const h = newElement("headline"); h.props.text = "You're in! Check your inbox.";
  const t = newElement("text"); t.props.text = "We've sent you everything you need. Keep an eye out for an email from us."; t.style.align = "center";
  sec.rows[0].columns[0].elements = [h, t];
  return { version: 1, settings: { background: "#FFFFFF", fontFamily: "Lato", color: "#2F2A26" }, sections: [sec] };
}

/* ------------------------------------------------------------------ checking before saving */

const HEX = /^#[0-9a-fA-F]{3,8}$/;
const RGBA = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/;
const color = (v: unknown) => (typeof v === "string" && (HEX.test(v) || RGBA.test(v) || v === "transparent") ? v : undefined);
const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v * 100) / 100)) : undefined);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);
const box = (v: unknown, lo: number, hi: number): [number, number, number, number] | undefined =>
  Array.isArray(v) && v.length === 4 ? (v.map((n) => num(n, lo, hi) ?? 0) as [number, number, number, number]) : undefined;
const pick = <T extends string>(v: unknown, list: readonly T[]) => (list.includes(v as T) ? (v as T) : undefined);
const id = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{1,16}$/i.test(v) ? v : newId());

/** Only https pictures and links (and mailto:/tel: for links). */
export const safeUrl = (v: unknown, links = false): string | undefined => {
  if (typeof v !== "string" || !v.trim() || v.length > 500) return undefined;
  try {
    const u = new URL(v.trim());
    if (u.protocol === "https:" || (links && (u.protocol === "http:" || u.protocol === "mailto:" || u.protocol === "tel:"))) return u.toString();
  } catch { /* not a link */ }
  return undefined;
};
/** Only Vimeo and YouTube players (see src/lib/landing/video.ts). */
const safeVideo = (v: unknown) => (typeof v === "string" && /^https:\/\/(player\.vimeo\.com\/video\/[0-9]{3,15}(\?h=[A-Za-z0-9]{1,20})?|www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{6,20})$/.test(v) ? v : undefined);

function cleanStyle(s: unknown): Style {
  const o = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
  const out: Style = {
    padding: box(o.padding, 0, 400), margin: box(o.margin, -200, 400),
    background: color(o.background), backgroundImage: safeUrl(o.backgroundImage), color: color(o.color),
    fontFamily: pick(o.fontFamily, FONTS), fontSize: num(o.fontSize, 8, 120), fontWeight: num(o.fontWeight, 100, 900),
    lineHeight: num(o.lineHeight, 0.8, 3), letterSpacing: num(o.letterSpacing, -5, 20),
    italic: o.italic === true ? true : undefined, uppercase: o.uppercase === true ? true : undefined,
    align: pick(o.align, ["left", "center", "right"] as const), radius: num(o.radius, 0, 200), shadow: pick(o.shadow, ["none", "sm", "md", "lg"] as const),
    borderWidth: num(o.borderWidth, 0, 20), borderColor: color(o.borderColor), maxWidth: num(o.maxWidth, 100, 2000),
  };
  for (const k of Object.keys(out) as (keyof Style)[]) if (out[k] === undefined) delete out[k];
  return out;
}

function cleanProps(type: ElementType, p: unknown): Props {
  const o = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
  const out: Props = {};
  if (["headline", "subheadline", "text", "button"].includes(type)) out.text = str(o.text, 3000) ?? "";
  if (type === "button") {
    out.subtext = str(o.subtext, 200);
    out.action = pick(o.action, ["next", "url", "step"] as const) ?? "next";
    out.href = safeUrl(o.href, true);
    out.step = typeof o.step === "string" && /^[a-z0-9-]{1,50}$/.test(o.step) ? o.step : undefined;
  }
  if (type === "image") { out.src = safeUrl(o.src) ?? ""; out.alt = str(o.alt, 200) ?? ""; out.href = safeUrl(o.href, true); }
  if (type === "video") out.video = safeVideo(o.video) ?? "";
  if (type === "form") {
    const f = Array.isArray(o.fields) ? o.fields.filter((x): x is FormField => ["first_name", "last_name", "email", "phone"].includes(x as string)) : [];
    out.fields = Array.from(new Set(f.length ? f : ["email" as FormField]));
    out.buttonText = str(o.buttonText, 80) ?? "Submit";
  }
  if (type === "button" || type === "form") { out.buttonColor = color(o.buttonColor); out.buttonTextColor = color(o.buttonTextColor); }
  if (type === "list") out.items = (Array.isArray(o.items) ? o.items : []).slice(0, 30).map((x) => str(x, 300) ?? "").filter(Boolean);
  if (type === "spacer" || type === "divider") out.height = num(o.height, 0, 400) ?? (type === "spacer" ? 40 : 1);
  for (const k of Object.keys(out) as (keyof Props)[]) if (out[k] === undefined) delete out[k];
  return out;
}

/** Throws away anything that is not part of a page and keeps every number, colour and link within bounds. */
export function sanitizePage(input: unknown): Page {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const st = (o.settings && typeof o.settings === "object" ? o.settings : {}) as Record<string, unknown>;
  const sections = (Array.isArray(o.sections) ? o.sections : []).slice(0, 60).map((sec): Section => {
    const s = (sec ?? {}) as Record<string, unknown>;
    return {
      id: id(s.id), style: cleanStyle(s.style),
      rows: (Array.isArray(s.rows) ? s.rows : []).slice(0, 20).map((row): Row => {
        const r = (row ?? {}) as Record<string, unknown>;
        const cols = (Array.isArray(r.columns) ? r.columns : []).slice(0, 4);
        return {
          id: id(r.id), style: cleanStyle(r.style),
          columns: (cols.length ? cols : [{}]).map((col): Column => {
            const c = (col ?? {}) as Record<string, unknown>;
            return {
              id: id(c.id), style: cleanStyle(c.style),
              elements: (Array.isArray(c.elements) ? c.elements : []).slice(0, 40).flatMap((el): El[] => {
                const e = (el ?? {}) as Record<string, unknown>;
                const type = pick(e.type, ELEMENT_TYPES);
                return type ? [{ id: id(e.id), type, props: cleanProps(type, e.props), style: cleanStyle(e.style) }] : [];
              }),
            };
          }),
        };
      }),
    };
  });
  return {
    version: 1,
    settings: { title: str(st.title, 120), background: color(st.background), fontFamily: pick(st.fontFamily, FONTS), color: color(st.color) },
    sections,
  };
}

/** A name turned into a short address part: "My Free Guide!" becomes "my-free-guide". */
export const slugify = (name: string) =>
  name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50).replace(/-+$/, "") || "page";
