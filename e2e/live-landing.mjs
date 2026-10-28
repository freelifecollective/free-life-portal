// Live check of a member's public landing page against the real Supabase project (no sign-in needed).
// Needs: migrations 0001-0003 applied, the app running, an upcoming leads-open call, and a finished member profile.
// Usage: USERNAME=sonyafruthven node e2e/live-landing.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = process.env.BASE ?? "http://localhost:3000";
const USERNAME = process.env.USERNAME;
if (!USERNAME) { console.log("Set USERNAME to a member's username."); process.exit(2); }
let failed = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) failed++; };
const rand = Math.random().toString(36).slice(2, 8);
const fakeEmail = `livetest-${rand}@example.invalid`;

const browser = await chromium.launch();
const mk = async (w = 1100) => { const ctx = await browser.newContext({ viewport: { width: w, height: 900 } }); const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(e.message.slice(0, 200))); page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|WebSocket|realtime/i.test(m.text())) errs.push(m.text().slice(0, 200)); }); return { ctx, page, errs }; };
const bar = (p) => p.locator(".goal-track").getAttribute("aria-valuenow").then(Number);

/* a visitor with no account opens the member's page */
const A = await mk();
const res = await A.page.goto(`${BASE}/${USERNAME}`);
ok(res.status() === 200, "the page opens without signing in");
await A.page.waitForSelector(".lp-hero");
const text = await A.page.locator("body").innerText();
ok(!/enagic/i.test(text), "the company name appears nowhere on the page");
ok(/Invited by:/i.test(text), "it has an 'Invited by:' section");
ok((await A.page.locator(".lp-invited").innerText()).trim().length > 20, "the member's name is shown there");
ok((await A.page.locator(".lp-invited .social a").count()) >= 0 && (await A.page.locator(".lp-invited .social a").evaluateAll((els) => els.every((e) => e.getBoundingClientRect().width <= 40))), "social buttons are small");
ok((await A.page.locator(".lp-invited").evaluate((e) => e.getBoundingClientRect().top)) > 2000 || (await A.page.evaluate(() => document.querySelector(".lp-invited").offsetTop > document.querySelector(".lp-hero").offsetTop + 1500)), "'Invited by' is near the bottom of the page");
ok(await A.page.locator("text=Only you can see these buttons").count() === 0, "visitors see no edit buttons");
ok(await A.page.locator(".goal-track").count() === 1, "the vertical goal bar is there");
const before = await bar(A.page);
ok(Number.isInteger(before), `the bar shows the current count (${before} of 500)`);
ok(/^(?:.*)500(?:.*)$/.test(await A.page.locator(".goal").innerText()), "the goal is 500");
ok(await A.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no sideways scrolling");

/* a second visitor has the page open at the same time */
const B = await mk(390);
await B.page.goto(`${BASE}/${USERNAME}`); await B.page.waitForSelector(".goal-track");
ok((await bar(B.page)) === before, "a second visitor sees the same number");

/* register on the first visitor's page */
await A.page.fill("#first", "Live"); await A.page.fill("#last", "Test"); await A.page.fill("#email", "bad");
await A.page.getByRole("button", { name: "Save my free spot" }).last().click();
await A.page.waitForSelector("text=valid email");
ok(true, "a bad email is refused with a message");
await A.page.fill("#email", fakeEmail);
await A.page.getByRole("button", { name: "Save my free spot" }).last().click();
await A.page.waitForSelector("text=tick the box");
await A.page.check("input[name=consent]");
await A.page.getByRole("button", { name: "Save my free spot" }).last().click();
await A.page.waitForSelector("text=You’re registered", { timeout: 15000 });
ok(true, "registering works and says so");

/* the OTHER visitor's bar moves without a refresh */
await B.page.waitForFunction((n) => Number(document.querySelector(".goal-track").getAttribute("aria-valuenow")) === n + 1, before, { timeout: 40000 });
ok(true, "the second visitor's bar went up by one by itself (live update or the 20-second check)");

/* routes that must stay private, and unknown names */
const C = await mk();
await C.page.goto(`${BASE}/calendar`); await C.page.waitForURL(/\/login/);
ok(true, "the portal's own pages still send signed-out visitors to the sign-in page");
const missing = await C.page.goto(`${BASE}/nobody-here-${rand}`);
ok(missing.status() === 404, "an unknown name is a 404");
const lead = process.env.LEAD_USERNAME;
if (lead) { const r = await C.page.goto(`${BASE}/${lead}`); ok(r.status() === 404, "a lead's name has no page"); }
ok(A.errs.length + B.errs.length + C.errs.length === 0, "no browser errors " + [...A.errs, ...B.errs, ...C.errs].join(" | "));
await browser.close();
console.log(`\nTest leftovers to remove (run in the Supabase SQL editor):
  delete from public.registrations where email = '${fakeEmail}';
  delete from public.signup_allowlist where email = '${fakeEmail}';
  delete from public.email_outbox where to_email = '${fakeEmail}';`);
console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL LANDING PAGE CHECKS PASSED");
process.exit(failed ? 1 : 0);
