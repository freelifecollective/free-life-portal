/**
 * The words on every member's landing page. One place to edit.
 * Rules: never name the company or its products, and make no promise of income.
 */
export const LANDING = {
  hero: {
    eyebrow: "Watch this first",
    title1: "You already know",
    title2: "something has to shift.",
    sub: "Here's the simple framework that took me to five figures in my very first month — part-time, from my phone, no experience needed.",
    cta: "Yes, send me the rest of the video",
    play: "Play the video",
  },
  /** Put the address of the video player here (for example https://player.vimeo.com/video/123456789) and the picture plays it right on the page. While it is empty, tapping the picture opens the sign-up box instead. */
  videoEmbedUrl: "" as string,
  join: {
    title: "Where should we send the rest of the video?",
    sub: "Add your name and we'll save your spot, then help you set up your free community account.",
  },
  hint: "(Hover over a testimonial to pause)",
  invitedBy: "Invited by:",
  legal: {
    rights: "©2026 Free Life Collective | All Rights Reserved",
    links: ["Terms of Use", "Privacy Policy", "Earnings Disclaimer"],
    facebook: "This site is not a part of the Facebook website or Facebook, Inc. Additionally this website is NOT endorsed by Facebook in any way. Facebook is a trademark of FACEBOOK, INC.",
    earnings: "Earnings Disclaimer: Any income or results mentioned are individual experiences and are not typical. Building an online business takes real work, and outcomes will vary widely based on your skills, effort, and market conditions. Nothing here is a promise or guarantee of earnings. This program provides training, tools, and support — what you do with them is up to you.",
  },
} as const;

/** The words a Builder can change on their page. Any left empty use the standard words above. */
export type LandingCopyKey = "eyebrow" | "title1" | "title2" | "sub" | "cta" | "join_title" | "join_sub";
export type LandingCopy = Partial<Record<LandingCopyKey, string>>;

/** Each changeable piece, its standard words, and how long it may be. */
export const COPY_FIELDS: { key: LandingCopyKey; label: string; standard: string; max: number; long?: boolean }[] = [
  { key: "eyebrow", label: "Small line above the headline", standard: LANDING.hero.eyebrow, max: 80 },
  { key: "title1", label: "Headline, first line", standard: LANDING.hero.title1, max: 80 },
  { key: "title2", label: "Headline, second line (in italics)", standard: LANDING.hero.title2, max: 80 },
  { key: "sub", label: "Text under the headline", standard: LANDING.hero.sub, max: 400, long: true },
  { key: "cta", label: "Button under the video", standard: LANDING.hero.cta, max: 80 },
  { key: "join_title", label: "Title of the sign-up box", standard: LANDING.join.title, max: 120 },
  { key: "join_sub", label: "Text in the sign-up box", standard: LANDING.join.sub, max: 300, long: true },
];

/** The words to show: the member's own where they set them, the standard ones everywhere else. */
export function wordsFor(copy: LandingCopy | null | undefined): Record<LandingCopyKey, string> {
  const out = {} as Record<LandingCopyKey, string>;
  for (const f of COPY_FIELDS) out[f.key] = copy?.[f.key]?.trim() || f.standard;
  return out;
}
