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
