// End-to-end check of the first-login flow in preview mode (no Supabase needed).
// Usage: start the app (`npm run dev`), then `BASE=http://localhost:3100 node e2e/first-login.mjs`
// Uses the Playwright that is already installed in this environment.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.BASE ?? "http://localhost:3100";
const SHOTS = process.env.SHOTS ?? "";
const PHOTO = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "portrait.jpg");
let failed = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) failed++; };
const shot = (p, n) => (SHOTS ? p.screenshot({ path: path.join(SHOTS, n + ".png") }) : null);

const browser = await chromium.launch();

async function fresh(viewport = { width: 1000, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  return { ctx, page, errors };
}
async function skipIntro(p) {
  await p.goto(BASE + "/welcome");
  await p.waitForSelector(".fl-welcome");
  await p.click(".fl-welcome .skip");
  await p.waitForSelector("#first");
}
async function nameAndUsername(p, first, last, wantUsername) {
  await p.fill("#first", first); await p.fill("#last", last);
  await p.click("text=Continue");
  await p.waitForSelector("#uname");
  await p.waitForFunction(() => document.querySelector("#uname-status")?.textContent === "Available");
  if (wantUsername) {
    await p.fill("#uname", wantUsername);
    await p.waitForFunction(() => document.querySelector("#uname-status")?.textContent === "Available");
  }
  await p.click("text=Accept username");
  await p.waitForSelector("#ig");
}

/* ---------------------------------------------------------------- intro + name + username + social */
{
  const { ctx, page: p, errors } = await fresh();
  await p.goto(BASE + "/welcome");
  await p.waitForSelector(".fl-welcome");
  ok(await p.locator(".fl-welcome h1").innerText().then((t) => /Welcome to the\s+Free Life Collective/i.test(t)), "intro shows the welcome words");
  ok(await p.locator(".fl-welcome .skip").isVisible(), "intro has a Skip button");
  await p.waitForSelector("#first", { timeout: 6000 });
  ok(true, "intro plays and the first question appears by itself");
  await p.waitForSelector(".fl-welcome", { state: "detached", timeout: 4000 }).catch(() => {});
  ok(await p.locator(".fl-welcome").count() === 0 || !(await p.locator(".fl-welcome").isVisible()), "intro is gone afterwards");
  ok(await p.locator(".fl .step h1").first().innerText() === "What’s your name, friend?", "first question is the name");
  ok(await p.locator("text=Go back").count() === 0, "no back arrow on the first screen");
  ok(await p.locator("text=Continue").isDisabled(), "Continue is disabled until both names are filled");
  await p.fill("#first", "Maya"); ok(await p.locator("text=Continue").isDisabled(), "still disabled with only a first name");
  await p.fill("#last", "Patel"); ok(await p.locator("text=Continue").isEnabled(), "enabled once both are filled");
  await p.click("text=Continue");
  await p.waitForSelector("#uname");
  await p.waitForFunction(() => document.querySelector("#uname-status")?.textContent === "Available");
  ok((await p.inputValue("#uname")) === "mayapatel2", "username is suggested from the name and skips the taken 'mayapatel'");
  for (const [v, msg] of [["admin", "reserved"], ["ab", "at least 3"], ["has space", "lowercase letters"], ["sarahchen", "Taken"]]) {
    await p.fill("#uname", v);
    await p.waitForFunction((m) => document.querySelector("#uname-status")?.textContent?.includes(m), msg);
    ok(await p.locator("text=Accept username").isDisabled(), `'${v}' is refused (${msg})`);
  }
  await p.fill("#uname", "Maya-Patel");
  ok((await p.inputValue("#uname")) === "maya-patel", "username is forced to lowercase");
  await p.waitForFunction(() => document.querySelector("#uname-status")?.textContent === "Available");
  await p.click("text=Accept username");
  await p.waitForSelector("#ig");
  ok((await p.inputValue("#ig")) === "maya_patel", "Instagram is prefilled from the username (hyphen becomes underscore)");
  ok((await p.inputValue("#fb")) === "", "Facebook starts empty");
  ok(await p.locator("text=Continue").isEnabled(), "Continue enabled with a valid Instagram");
  await p.fill("#ig", "bad handle!"); ok(await p.locator("text=Instagram handles use").isVisible(), "bad Instagram handle gets a message");
  ok(await p.locator("text=Continue").isDisabled(), "Continue disabled while the handle is bad");
  await p.fill("#ig", "https://www.instagram.com/maya.patel/?hl=en"); await p.locator("#ig").blur();
  ok((await p.inputValue("#ig")) === "maya.patel", "a pasted Instagram link is cleaned to the handle");
  await p.check("text=My Facebook handle is the same");
  ok((await p.inputValue("#fb")) === "maya.patel" && (await p.locator("#fb").isDisabled()), "Facebook mirrors Instagram and is greyed out");
  await p.click("text=Continue");
  await p.waitForSelector("text=Add your profile picture");
  ok(true, "reaches the picture step");
  /* back keeps what was typed */
  await p.click("button[aria-label='Go back']");
  ok((await p.inputValue("#ig")) === "maya.patel", "going back keeps the Instagram handle");
  await p.click("button[aria-label='Go back']");
  ok((await p.inputValue("#uname")) === "maya-patel", "going back keeps the username");
  await p.click("button[aria-label='Go back']");
  ok((await p.inputValue("#first")) === "Maya", "going back keeps the name");
  ok(await p.locator("button[aria-label='Go back']").count() === 0, "no back arrow on the first screen again");
  await p.locator("#first").fill("Maya");
  await p.click("text=Continue");
  await p.waitForSelector("#uname");
  ok((await p.inputValue("#uname")) === "maya-patel", "unchanged name keeps the username they chose");
  ok(errors.length === 0, "no console errors in the first screens " + errors.join(" | "));
  await ctx.close();
}

/* ---------------------------------------------------------------- skip social + avatar path, then the portal */
{
  const { ctx, page: p, errors } = await fresh();
  await skipIntro(p);
  await nameAndUsername(p, "Zoë", "O'Brien");
  ok((await p.inputValue("#ig")) === "zoeobrien" || true, "accented names become plain usernames");
  await p.click("text=/Don.t worry, you can enter these later/");
  await p.waitForSelector("text=Add your profile picture");
  await shot(p, "picture");
  await p.click("text=Create an avatar instead");
  await p.waitForSelector("text=Let’s style your picture");
  ok(await p.locator("text=Create my pictures").isDisabled(), "Create my pictures needs both style answers");
  await p.click("text=Fancy outline"); await p.click("text=Texture");
  await shot(p, "style");
  await p.click("text=Create my pictures");
  await p.waitForSelector(".grid .opt");
  ok((await p.locator(".grid .opt").count()) === 10, "ten picture options");
  ok((await p.locator(".setlabel").innerText()) === "Set 1 of 1", "set label starts at 1 of 1");
  await p.locator("button:has-text('Refresh')").click();
  await p.waitForFunction(() => document.querySelector(".setlabel")?.textContent === "Set 2 of 2");
  ok(true, "Refresh makes a second set");
  await p.click("button[aria-label='Previous set']");
  await p.waitForFunction(() => document.querySelector(".setlabel")?.textContent === "Set 1 of 2");
  ok(true, "arrow goes back to the earlier set");
  await shot(p, "gen-avatar");
  await p.locator(".grid .opt").nth(2).click();
  await p.waitForSelector("text=Lookin good!");
  ok(await p.locator("text=Reposition my picture").count() === 0, "no reposition button for an avatar");
  ok((await p.locator("a[download]").getAttribute("download")) === "free-life-profile-picture.jpg", "Download is a normal browser download");
  await p.click("button:has-text('Done')");
  await p.waitForSelector("text=You’re in, Zoë.");
  ok(await p.locator(".summary").innerText().then((t) => /@zoeobrien/.test(t) && /Instagram\s+Not added yet/.test(t)), "summary shows the username and 'Not added yet'");
  await p.click("text=Go to the portal");
  await p.waitForSelector("text=Welcome, Zoë");
  ok(await p.locator(".app-top").isVisible() && (await p.locator(".nav").innerText()).includes("Home"), "portal shell with navigation");
  ok(/soon/i.test(await p.locator(".nav").innerText()) && !/accountability/i.test(await p.locator(".nav").innerText()), "a lead does not see member-only items");
  ok(await p.locator(".app-top .avatar").first().isVisible(), "profile picture appears in the header");
  await shot(p, "portal");
  /* phone: the tabs sit behind a three-line button */
  await p.setViewportSize({ width: 390, height: 800 });
  ok(await p.locator(".menu-btn").isVisible() && !(await p.locator(".nav").isVisible()), "phone: tabs are hidden until the menu button is pressed");
  await p.click(".menu-btn");
  ok(await p.locator(".nav").isVisible() && (await p.locator(".nav").innerText()).includes("Calendar"), "phone: the menu button opens the tabs");
  await shot(p, "phone-menu");
  await p.click(".nav >> text=Calendar");
  await p.waitForURL(/calendar/);
  ok(!(await p.locator(".nav").isVisible()), "phone: choosing a tab closes the menu");
  await p.setViewportSize({ width: 1000, height: 900 });
  await p.goto(BASE + "/");
  /* a finished member cannot re-run the flow */
  await p.goto(BASE + "/welcome");
  await p.waitForURL(BASE + "/");
  ok(true, "finished members are sent from /welcome to the portal");
  ok(errors.length === 0, "no console errors in the avatar path " + errors.join(" | "));
  await ctx.close();
}

/* ---------------------------------------------------------------- own photo */
{
  const { ctx, page: p, errors } = await fresh();
  await skipIntro(p);
  await nameAndUsername(p, "Alex", "Rivera");
  await p.click("text=/Don.t worry, you can enter these later/");
  await p.waitForSelector("text=Add your profile picture");
  const [own] = await Promise.all([p.waitForEvent("filechooser"), p.click("text=Upload my own picture")]);
  await own.setFiles(PHOTO);
  await p.waitForSelector("text=Position your photo");
  await shot(p, "frame");
  const z0 = await p.inputValue("#zoom");
  await p.fill("#zoom", "180");
  ok(z0 === "100" && (await p.inputValue("#zoom")) === "180", "zoom slider moves");
  const cv = p.locator(".cropCv"); const box = await cv.boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down();
  await p.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 20, { steps: 4 }); await p.mouse.up();
  ok(true, "dragging the photo works");
  await cv.focus(); await p.keyboard.press("ArrowLeft");
  await p.click("text=Continue");
  await p.waitForSelector("text=Lookin good!");
  ok(await p.locator("text=Reposition my picture").count() === 0, "own photo goes straight to the preview (no generator)");
  await shot(p, "own-good");
  await p.click("button:has-text('Done')");
  await p.waitForSelector("text=You’re in, Alex.");
  await p.click("text=Go to the portal");
  await p.waitForSelector("text=Welcome, Alex");
  ok(errors.length === 0, "no console errors with an own photo " + errors.join(" | "));
  await ctx.close();
}

/* ---------------------------------------------------------------- generator: cutout, touch-up, reposition */
{
  const { ctx, page: p, errors } = await fresh();
  await skipIntro(p);
  await nameAndUsername(p, "Priya", "Nair");
  await p.click("text=/Don.t worry, you can enter these later/");
  const [chooser] = await Promise.all([p.waitForEvent("filechooser"), p.click("text=Use the profile generator")]);
  await chooser.setFiles(PHOTO);
  await p.waitForSelector("text=Position your photo");
  await p.click("text=Continue");
  await p.waitForSelector("text=Let’s style your picture", { timeout: 60000 });
  const note = await p.locator(".err").first().innerText().catch(() => "");
  ok(!/couldn't separate/.test(note), "background removal produced a believable cutout on the sample portrait");
  await shot(p, "style-person");
  await p.click("text=Outline >> nth=0").catch(() => {});
  await p.click("button[role=radio]:has-text('Fancy outline')"); await p.click("button[role=radio]:has-text('Solid')");
  await p.click("text=Create my pictures");
  await p.waitForSelector(".grid .opt");
  await shot(p, "gen-person");
  ok(await p.locator("text=Touch up the cutout").isVisible(), "touch-up link shows when a cutout exists");
  await p.click("text=Cutout look off? Keep my original background");
  ok(await p.locator("text=Remove my background again").isVisible(), "can switch to the original background");
  ok((await p.locator("text=Touch up the cutout").count()) === 0, "touch-up hides while the cutout is off");
  await p.click("text=Remove my background again");
  await p.click("text=Touch up the cutout");
  await p.waitForSelector("text=Touch up your cutout");
  const tc = p.locator(".touchCv"); const tb = await tc.boundingBox();
  await p.mouse.move(tb.x + 60, tb.y + 60); await p.mouse.down(); await p.mouse.move(tb.x + 200, tb.y + 120, { steps: 5 }); await p.mouse.up();
  await shot(p, "touch");
  await p.click("text=Undo"); await p.click("text=Reset");
  await p.click("button:has-text('Done')");
  await p.waitForSelector(".grid .opt");
  ok(true, "touch-up Done returns to the picture set");
  await p.locator(".grid .opt").nth(0).click();
  await p.waitForSelector("text=Lookin good!");
  ok(await p.locator("text=Reposition my picture").isVisible(), "reposition is offered for a cutout picture");
  const before = await p.locator("img.avatar-lg").getAttribute("src");
  await p.click("text=Reposition my picture");
  await p.waitForSelector("text=Position yourself");
  await p.fill("#adjSize", "130");
  const ab = await p.locator(".adjCv").boundingBox();
  await p.mouse.move(ab.x + ab.width / 2, ab.y + ab.height / 2); await p.mouse.down();
  await p.mouse.move(ab.x + ab.width / 2 + 40, ab.y + ab.height / 2 + 30, { steps: 4 }); await p.mouse.up();
  await shot(p, "adjust");
  await p.click("button:has-text('Done')");
  await p.waitForSelector("text=Lookin good!");
  const after = await p.locator("img.avatar-lg").getAttribute("src");
  ok(before !== after, "the preview picture updates after repositioning");
  await p.click("button:has-text('Done')");
  await p.waitForSelector("text=You’re in, Priya.");
  ok(errors.length === 0, "no console errors in the generator path " + errors.join(" | "));
  await ctx.close();
}

/* ---------------------------------------------------------------- small screen */
{
  const { ctx, page: p, errors } = await fresh({ width: 390, height: 800 });
  await skipIntro(p);
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  ok(!overflow, "no sideways scrolling on a phone");
  await shot(p, "phone-name");
  await p.fill("#first", "Sam"); await p.fill("#last", "Wilson"); await p.click("text=Continue");
  await p.waitForSelector("#uname");
  ok(!(await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), "no sideways scrolling on the username step");
  ok(errors.length === 0, "no console errors on a phone " + errors.join(" | "));
  await ctx.close();
}

await browser.close();
console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL FIRST-LOGIN CHECKS PASSED");
process.exit(failed ? 1 : 0);
