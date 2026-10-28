/**
 * The words on every member's landing page. One place to edit.
 * Rules: never name the company or its products, and make no promise of income.
 */
export const LANDING = {
  hero: {
    eyebrow: "A free live community call",
    title: "What if your life ran on your terms, not your employer's?",
    sub: "Join a free live call with a community of everyday people building online businesses from home, and see what could be possible for you.",
    cta: "Save my free spot",
  },
  pain: {
    title: "Does any of this sound familiar?",
    items: [
      "You're exhausted from trading your best hours for someone else's goals.",
      "Your paycheck is gone almost as fast as it arrives, and you can't see a way out of the cycle.",
      "You miss moments with the people you love because work always comes first.",
      "You've dreamed of building something of your own, but never knew where to start.",
      "You've tried things before and ended up alone, confused or let down.",
    ],
  },
  fears: {
    title: "And the thoughts that keep you stuck",
    items: [
      "I don't have the experience.",
      "What if I fail and look foolish?",
      "I don't have the time.",
      "I'm not a salesperson.",
      "Is any of this even real?",
      "I can't afford to take a risk right now.",
    ],
    after: "If any of those landed, nothing is wrong with you. Almost everyone who loves what they do today started with these exact thoughts.",
  },
  shift: {
    title: "The problem was never you.",
    body: [
      "You were never handed a roadmap. You were never given a mentor, or a community that wanted you to win.",
      "Doing it alone is hard. Doing it with a clear path and people beside you changes everything.",
    ],
  },
  future: {
    title: "Picture your life a year from now",
    items: [
      "You wake up without the dread, and you decide what your day looks like.",
      "You're fully present for your family: at the school pickup, at the table, on the trip you kept postponing.",
      "Money feels calm instead of tight, because you've built something that is yours.",
      "You're surrounded by people who cheer you on and keep you going on the hard days.",
      "You carry the quiet confidence of having done what you once thought you couldn't.",
    ],
  },
  possible: {
    title: "Starting your own online business is closer than you think",
    body: "Every week our community call shows everyday people how an online business works, what a simple first step looks like, and how others who started right where you are are doing it, with support at every step.",
    youGet: [
      "Real stories from people who started where you are",
      "A clear picture of how an online business works",
      "Your questions answered live",
      "A free community account with trainings and resources to explore",
    ],
  },
  join: {
    title: "Your seat is free",
    sub: "Add your name and we'll save your spot, then help you set up your free community account.",
  },
  faq: [
    { q: "Is it really free?", a: "Yes. The call and your community account are free." },
    { q: "Do I need any experience?", a: "No. The call is built for people starting from zero." },
    { q: "What if I can't make it live?", a: "Register anyway. You'll be able to choose to watch the recording." },
  ],
  invitedBy: "Invited by:",
  disclaimer: "Results vary and depend on individual effort, skills and circumstances. Nothing on this page is a promise or guarantee of income.",
} as const;
