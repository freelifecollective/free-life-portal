import { buildDict, translateText, type Dict, type Lang } from "./match";

const ATTRS = ["placeholder", "title", "aria-label", "alt"] as const;
const SKIP = "script, style, noscript, textarea, [translate='no'], .notranslate, [contenteditable='true'], [data-i18n='skip']";

/** Replaces English words on the page with the portal's own translations, and keeps doing so as the page changes. */
export function startTranslator(lang: Lang, dict: Dict): () => void {
  const done = new WeakMap<Node, string>(); // text we wrote, so our own edit is not translated again
  document.documentElement.lang = lang;

  const skipped = (el: Element | null) => !el || !!el.closest(SKIP);

  function text(node: Text) {
    const v = node.nodeValue ?? "";
    if (done.get(node) === v) return;
    if (skipped(node.parentElement)) return;
    const t = translateText(v, dict);
    if (t !== null && t !== v) { node.nodeValue = t; done.set(node, t); }
  }
  function attrs(el: Element) {
    if (skipped(el)) return;
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (!v) continue;
      const t = translateText(v, dict);
      if (t !== null && t !== v) el.setAttribute(a, t);
    }
    if (el instanceof HTMLInputElement && (el.type === "submit" || el.type === "button") && el.value) {
      const t = translateText(el.value, dict);
      if (t) el.value = t;
    }
  }
  function walk(root: Node) {
    if (root.nodeType === Node.TEXT_NODE) { text(root as Text); return; }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    const el = root as Element;
    if (skipped(el)) return;
    attrs(el);
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n: Node | null = tw.nextNode();
    while (n) {
      if (n.nodeType === Node.TEXT_NODE) text(n as Text); else attrs(n as Element);
      n = tw.nextNode();
    }
  }
  function title() {
    const t = document.title;
    const parts = t.split(" | ").map((p) => translateText(p, dict) ?? p);
    const next = parts.join(" | ");
    if (next !== t) document.title = next;
  }

  walk(document.body);
  title();

  const obs = new MutationObserver((records) => {
    obs.disconnect();
    try {
      for (const r of records) {
        if (r.type === "childList") r.addedNodes.forEach((n) => walk(n));
        else if (r.type === "characterData") text(r.target as Text);
        else if (r.type === "attributes") attrs(r.target as Element);
      }
      title();
    } finally { watch(); }
  });
  function watch() { obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS, "value"] }); }
  watch();
  const titleObs = new MutationObserver(title);
  const titleEl = document.querySelector("title");
  if (titleEl) titleObs.observe(titleEl, { childList: true, characterData: true, subtree: true });

  return () => { obs.disconnect(); titleObs.disconnect(); };
}

export async function loadDict(lang: Lang): Promise<Dict> {
  const { ENTRIES } = await import("./entries");
  return buildDict(ENTRIES, lang);
}
