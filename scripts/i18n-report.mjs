/**
 * Lists the words on screen that have no translation yet.
 *   node scripts/i18n-report.mjs            counts per file
 *   node scripts/i18n-report.mjs <path>     the missing strings for files whose path contains <path>
 *   node scripts/i18n-report.mjs --all      every missing string
 * Strings come from: text between tags, placeholder/title/aria-label/alt, text inside {...} in a page, error/label/message-style
 * properties, confirm/prompt dialogs, and whole "data" files (menus, quotes, questionnaire...).
 */
import ts from "typescript";
import fs from "fs";
import path from "path";

const arg = process.argv[2] ?? "";
const ENT = "src/i18n/entries";
const DATA = [/lib\/quotes\/data/, /lib\/buddy\/questions/, /lib\/badges\/defs/, /lib\/recordings\/topics/, /lib\/tour/, /lib\/calls\/types/, /lib\/chats\/emoji/ , /lib\/calculator\/data/, /components\/landing\/content/, /lib\/tasks\/schedule/];
const KEYS = new Set(["error", "message", "label", "title", "description", "placeholder", "lede", "hint", "text", "note", "heading", "empty", "subtitle", "body", "cta", "sub", "q", "h", "ph", "o", "sec", "name"]);
const ATTR = new Set(["placeholder", "title", "aria-label", "alt", "label", "aria-description", "lede", "description", "hint", "subtitle"]);
const ENTITIES = { "&rsquo;": "’", "&lsquo;": "‘", "&ldquo;": "“", "&rdquo;": "”", "&amp;": "&", "&quot;": '"', "&apos;": "'", "&nbsp;": " ", "&mdash;": "—", "&ndash;": "–", "&middot;": "·", "&hellip;": "…", "&lt;": "<", "&gt;": ">" };
const dec = (s) => s.replace(/&[a-z]+;/g, (m) => ENTITIES[m] ?? m);
const norm = (s) => s.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"').replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();

function walk(d, out = []) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (f === "__tests__") continue; walk(p, out); } else if (/\.tsx?$/.test(f) && !/\.test\./.test(f)) out.push(p); } return out; }
function sourceFile(f) { return ts.createSourceFile(f, fs.readFileSync(f, "utf8"), ts.ScriptTarget.Latest, true, f.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS); }

// what is already translated
const have = new Set();
for (const f of fs.readdirSync(ENT)) {
  if (!f.endsWith(".ts") || f === "index.ts") continue;
  (function v(n) { if (ts.isArrayLiteralExpression(n) && n.elements.length === 5 && n.elements.every((e) => ts.isStringLiteralLike(e))) have.add(norm(n.elements[0].text)); ts.forEachChild(n, v); })(sourceFile(path.join(ENT, f)));
}
const patternToRe = [...have].filter((k) => /\{\d\}/.test(k)).map((k) => new RegExp("^" + k.split(/(\{\d\})/).map((p) => (/^\{\d\}$/.test(p) ? "(.+?)" : p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).join("") + "$"));
const covered = (s) => have.has(s) || patternToRe.some((re) => re.test(s));

const isText = (s, strict) => {
  if (!/[A-Za-z\u00c0-\u024f]{2}/.test(s)) return false;
  if (!strict) return true;                       // plain text between tags: always
  if (/^[a-z0-9_\-./:#?=&%\[\]]+$/.test(s)) return false; // an identifier, class name or path
  if (/^[a-z0-9_\-./:#?=&%\[\] ]+$/.test(s) && /[-_/:.\d]/.test(s)) return false; // several class names
  return true;
};
const looksUi = (s, strict) => isText(s, strict) && !/^(https?:|\/|#|\.|[a-z]+[A-Z]|[A-Z_]{3,}$)/.test(s) && !/[{};]\s*$/.test(s) && !/^(var\(|rgb|linear-gradient|M\d|url\(|min\(|rotate|translate|\d+px)/.test(s);

const found = new Map(); // string -> Set(files)
function add(s, file, strict = true) { const t = norm(dec(s)); if (!t || !looksUi(t, strict) || covered(t)) return; if (!found.has(t)) found.set(t, new Set()); found.get(t).add(file); }
function templ(n) { if (ts.isNoSubstitutionTemplateLiteral(n)) return n.text; let i = 0, out = n.head.text; for (const sp of n.templateSpans) { out += `{${i++}}` + sp.literal.text; } return out; }

for (const file of walk("src")) {
  if (file.startsWith("src/i18n")) continue;
  const sf = sourceFile(file);
  const isData = DATA.some((re) => re.test(file));
  const inExpr = (n) => { for (let p = n.parent; p; p = p.parent) { if (ts.isJsxExpression(p)) return true; if (ts.isJsxAttribute(p)) return ATTR.has(p.name.text); if (ts.isFunctionLike(p) && !ts.isArrowFunction(p)) return false; } return false; };
  (function v(n) {
    if (ts.isJsxText(n)) add(n.text, file, false);
    else if (ts.isJsxAttribute(n) && ATTR.has(n.name.text) && n.initializer && ts.isStringLiteral(n.initializer)) add(n.initializer.text, file);
    else if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && !ts.isImportDeclaration(n.parent) && !ts.isJsxAttribute(n.parent)) {
      const par = n.parent;
      const keyed = ts.isPropertyAssignment(par) && par.initializer === n && KEYS.has(par.name.getText());
      const arg = ts.isCallExpression(par) && /(confirm|prompt|alert)$/.test(par.expression.getText());
      if (isData || keyed || arg || inExpr(n)) add(n.text, file);
    } else if (ts.isTemplateExpression(n)) {
      const par = n.parent;
      const keyed = ts.isPropertyAssignment(par) && KEYS.has(par.name.getText());
      const arg = ts.isCallExpression(par) && /(confirm|prompt|alert)$/.test(par.expression.getText());
      if (isData || keyed || arg || inExpr(n)) add(templ(n), file);
    }
    ts.forEachChild(n, v);
  })(sf);
}

const byFile = new Map();
for (const [s, files] of found) for (const f of files) { if (!byFile.has(f)) byFile.set(f, []); byFile.get(f).push(s); }
if (!arg) {
  const rows = [...byFile].map(([f, a]) => [a.length, f]).sort((a, b) => b[0] - a[0]);
  for (const [n, f] of rows) console.log(String(n).padStart(4), f);
  console.log("---- strings missing:", found.size, "in", byFile.size, "files; already translated:", have.size);
} else {
  const want = [...byFile].filter(([f]) => arg === "--all" || f.includes(arg));
  const seen = new Set();
  for (const [f, a] of want) { console.log("\n# " + f); for (const s of a) if (!seen.has(s)) { seen.add(s); console.log(JSON.stringify(s)); } }
}
