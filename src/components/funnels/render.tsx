import type { CSSProperties, ReactNode } from "react";
import { FIELD_LABELS, SHADOWS, type El, type Page, type Style } from "@/lib/funnels/types";

/** Turns a piece's settings into CSS. Every value was checked when the page was saved (sanitizePage). */
export function css(s: Style | undefined, kind: "section" | "row" | "column" | "element"): CSSProperties {
  if (!s) return {};
  const px = (b?: [number, number, number, number]) => (b ? `${b[0]}px ${b[1]}px ${b[2]}px ${b[3]}px` : undefined);
  const out: CSSProperties = {
    padding: px(s.padding), margin: px(s.margin),
    background: s.background, color: s.color,
    fontFamily: s.fontFamily ? `"${s.fontFamily}", system-ui, sans-serif` : undefined,
    fontSize: s.fontSize, fontWeight: s.fontWeight, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing,
    fontStyle: s.italic ? "italic" : undefined, textTransform: s.uppercase ? "uppercase" : undefined,
    textAlign: s.align, borderRadius: s.radius, boxShadow: s.shadow && s.shadow !== "none" ? SHADOWS[s.shadow] : undefined,
    border: s.borderWidth ? `${s.borderWidth}px solid ${s.borderColor ?? "#E4DED6"}` : undefined,
  };
  if (s.backgroundImage) { out.backgroundImage = `url("${s.backgroundImage.replace(/"/g, "%22")}")`; out.backgroundSize = "cover"; out.backgroundPosition = "center"; }
  /* a row or element with a widest size sits in the middle of its section */
  if (s.maxWidth && kind !== "section") { out.maxWidth = s.maxWidth; out.marginLeft = out.marginLeft ?? "auto"; out.marginRight = out.marginRight ?? "auto"; }
  if (s.maxWidth && kind === "section") out.maxWidth = undefined;
  return out;
}

/** The Google fonts a page uses, so the page can load them. */
export function fontsOf(page: Page): string[] {
  const set = new Set<string>();
  const add = (f?: string) => { if (f && !["Georgia", "Arial"].includes(f)) set.add(f); };
  add(page.settings.fontFamily);
  for (const s of page.sections) { add(s.style.fontFamily); for (const r of s.rows) for (const c of r.columns) for (const e of c.elements) add(e.style.fontFamily); }
  return [...set];
}
export const fontHref = (fonts: string[]) =>
  fonts.length ? `https://fonts.googleapis.com/css2?${fonts.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:ital,wght@0,400;0,700;1,400`).join("&")}&display=swap` : null;

/** Text keeps its line breaks; nothing in it is ever read as HTML. */
const lines = (t?: string) => (t ?? "").split("\n").flatMap((l, i) => (i ? [<br key={i} />, l] : [l]));

export type Links = {
  /** where a button with "next step" goes */
  next: string | null;
  /** where a button with a chosen step goes */
  step: (slug: string) => string;
  /** the form, drawn by the page that knows how to send it */
  form?: (el: El) => ReactNode;
  /** in the editor, empty pictures and videos show a placeholder; on the live page they are left out */
  editing?: boolean;
};

/** One element of a page, as visitors see it. The editor draws the same thing. */
export function ElementView({ el, links }: { el: El; links: Links }) {
  const p = el.props;
  const style = css(el.style, "element");
  switch (el.type) {
    case "headline": return <h1 className="fn-el" style={{ margin: 0, ...style }}>{lines(p.text)}</h1>;
    case "subheadline": return <h2 className="fn-el" style={{ margin: 0, ...style }}>{lines(p.text)}</h2>;
    case "text": return <p className="fn-el" style={{ margin: 0, ...style }}>{lines(p.text)}</p>;
    case "list": return <ul className="fn-el fn-bullets" style={style}>{(p.items ?? []).map((t, i) => <li key={i}>{t}</li>)}</ul>;
    case "divider": return <div className="fn-el" style={{ ...style, color: undefined }}><hr style={{ border: 0, borderTop: `${p.height ?? 1}px solid ${el.style.color ?? "#E4DED6"}`, margin: 0 }} /></div>;
    case "spacer": return <div className="fn-el" style={{ ...style, height: p.height ?? 40 }} aria-hidden="true" />;
    case "image": {
      if (!p.src && !links.editing) return null;
      const img = p.src
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={p.src} alt={p.alt ?? ""} style={{ maxWidth: "100%", height: "auto", borderRadius: el.style.radius, boxShadow: style.boxShadow, display: "inline-block" }} />
        : <div className="fn-empty">Image: choose a picture</div>;
      return <div className="fn-el" style={{ ...style, borderRadius: undefined, boxShadow: undefined }}>{p.href ? <a href={p.href} rel="noopener noreferrer">{img}</a> : img}</div>;
    }
    case "video": if (!p.video && !links.editing) return null; return (
      <div className="fn-el" style={style}>
        {p.video
          ? <div className="fn-video" style={{ borderRadius: el.style.radius }}><iframe src={p.video} title="Video" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen /></div>
          : <div className="fn-empty fn-video">Video: paste a Vimeo or YouTube link</div>}
      </div>
    );
    case "button": {
      const href = p.action === "url" ? p.href : p.action === "step" && p.step ? links.step(p.step) : links.next;
      const btn = (
        <span className="fn-btn" style={{ background: p.buttonColor ?? "#8C6F5E", color: p.buttonTextColor ?? "#fff", borderRadius: el.style.radius, fontSize: el.style.fontSize, fontWeight: el.style.fontWeight, fontFamily: style.fontFamily, boxShadow: style.boxShadow, textTransform: style.textTransform, letterSpacing: el.style.letterSpacing }}>
          {lines(p.text)}{p.subtext ? <small>{p.subtext}</small> : null}
        </span>
      );
      return <div className="fn-el" style={{ ...style, borderRadius: undefined, boxShadow: undefined, fontSize: undefined, fontWeight: undefined }}>{href ? <a href={href} className="fn-btn-link" rel={p.action === "url" ? "noopener noreferrer" : undefined}>{btn}</a> : btn}</div>;
    }
    case "form": return (
      <div className="fn-el" style={style}>
        {links.form ? links.form(el) : <FormPreview el={el} />}
      </div>
    );
  }
}

/** How a form looks (the editor shows this; the live page swaps in a form that sends). */
export function FormPreview({ el }: { el: El }) {
  return (
    <div className="fn-form">
      {(el.props.fields ?? []).map((f) => <input key={f} className="fn-input" placeholder={FIELD_LABELS[f]} disabled />)}
      <span className="fn-btn" style={{ background: el.props.buttonColor ?? "#8C6F5E", color: el.props.buttonTextColor ?? "#fff", borderRadius: el.style.radius ?? 10 }}>{el.props.buttonText ?? "Submit"}</span>
    </div>
  );
}

/** A whole page, as visitors see it. */
export function PageView({ page, links }: { page: Page; links: Links }) {
  return (
    <div className="fn-page" style={{ background: page.settings.background, color: page.settings.color, fontFamily: page.settings.fontFamily ? `"${page.settings.fontFamily}", system-ui, sans-serif` : undefined }}>
      {page.sections.map((s) => (
        <section key={s.id} className="fn-section" style={css(s.style, "section")}>
          {s.rows.map((r) => (
            <div key={r.id} className="fn-row" style={css(r.style, "row")}>
              {r.columns.map((c) => (
                <div key={c.id} className="fn-col" style={css(c.style, "column")}>
                  {c.elements.map((e) => <ElementView key={e.id} el={e} links={links} />)}
                </div>
              ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
