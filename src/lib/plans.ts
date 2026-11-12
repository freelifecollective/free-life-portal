/* The paid plans: the cards on Choose Your Plan and the sales page each card opens. Change the words here and both update. */
export type PlanTier = 47 | 97 | 297;
export const PLAN_TIERS: PlanTier[] = [47, 97, 297];
export const isPlanTier = (n: unknown): n is PlanTier => PLAN_TIERS.includes(n as PlanTier);

export type PlanFeature = { name: string; text: string };

export type Plan = {
  tier: PlanTier;
  name: string;
  /** one line under the price on the card */
  blurb: string;
  /** the short list on the card */
  features: string[];
  popular?: boolean;
  /* the sales page */
  headline: string;
  pitch: string;
  forWho: string[];
  /** what this plan adds on top of the plan below it (all of it, for the first plan) */
  includes: PlanFeature[];
};

export const PLANS: Plan[] = [
  {
    tier: 47,
    name: "Starter",
    blurb: "Everything you need to begin.",
    features: ["Everything in the Free Life Collective portal", "Community chats, calls and courses", "Sales and tracking tools", "Your own landing page"],
    headline: "Everything you need to run your Enagic business, in one place.",
    pitch: "Your team, your training and your tools live together, so you spend less time searching and more time sharing water.",
    forWho: [
      "You're new and want a clear place to start.",
      "You're tired of digging through Google Drives and group chats for resources.",
      "You want simple tools that help you place your next sale.",
    ],
    includes: [
      { name: "Community chats", text: "Connect with the whole collective, ask questions and share wins." },
      { name: "Calls, calendar and recordings", text: "Every team call in one calendar, easy to join, with recordings of the ones you missed." },
      { name: "Courses", text: "Step-by-step training to grow your business, including the Business Launch Course." },
      { name: "Everything in one place", text: "Books, product information, pictures and videos, Canva templates and the evidence manual, all together and easy to find." },
      { name: "Landing page", text: "A ready-made landing page to send to your leads. Choose whether it plays the video that comes with your account or your coach's video." },
      { name: "Placing sales", text: "The earnings estimator, create a quote, your booking calendar, financing options, verbiage and objections, and call closers for hire." },
      { name: "Tracking", text: "Lead tracking, know your numbers and my team, so you always know where you stand." },
      { name: "Onboarding and daily habits", text: "Your accountability buddy, weekly focus, tasks, the graphic maker and Facebook follows." },
      { name: "Your organization", text: "Map out your current organization to help keep you balanced, and create a vision board organization that maps you out to legacy." },
      { name: "Water share map", text: "Add yourself to the map and find other FLC members who can share water with your leads." },
    ],
  },
  {
    tier: 97,
    name: "Builder",
    blurb: "Build your own marketing, your way.",
    popular: true,
    features: ["Everything in Starter", "A fully customizable landing page", "Unlimited funnels, forms, automations, emails and texts", "Free Life AI", "Sell your own courses"],
    headline: "Build funnels, automations and courses of your own.",
    pitch: "Design your own pages and follow-up from scratch, or ask Free Life AI to build them for you, right inside your account.",
    forWho: [
      "You want your marketing to look and sound like you.",
      "You want follow-up that runs on its own, by email and text.",
      "You have knowledge to teach and want to sell your own course.",
    ],
    includes: [
      { name: "Fully customizable landing page", text: "Change the wording, pictures, video and text, or throw out the whole design and make something completely different." },
      { name: "Funnels", text: "Build as many funnels as you want, with as many steps as you want. Add elements and adjust padding, shadows, fonts and sizes, as easily as in ClickFunnels." },
      { name: "Forms", text: "Create your own forms to capture leads and answers." },
      { name: "Automations", text: "Set up follow-up that runs on its own when something happens." },
      { name: "Emails and texts", text: "Start with ready-made emails and texts, change them however you like, or write your own." },
      { name: "Free Life AI", text: "An AI assistant that does everything you'd expect, and builds funnels, forms, automations, emails and texts straight into your account at the press of a button. A monthly allowance is included, and you can top up your wallet when you need more." },
      { name: "Your notifications", text: "Choose what you want to hear about in your account, and get a text, an email or both when it happens." },
      { name: "Sell your own courses", text: "Create your own courses and connect your Stripe or PayPal account to sell them, outside of Enagic." },
    ],
  },
  {
    tier: 297,
    name: "Leader",
    blurb: "For verified members of Lacey's downline.",
    features: ["Everything in Builder", "Your own branded portal", "FLC calls, recordings and courses inside it"],
    headline: "Your own branded portal, with everything FLC built in.",
    pitch: "Run your team from a portal with your name and brand on it, with our calls, recordings and courses already inside, always up to date.",
    forWho: [
      "You're a verified member of Lacey's downline.",
      "You lead a team and want a platform that carries your own brand.",
      "You want your team to get every FLC call and course without extra work.",
    ],
    includes: [
      { name: "Your own branded portal", text: "The whole portal, white-labelled with your platform name, logo and brand colours, on your own web address." },
      { name: "Lacey's Downline chat", text: "Stay in the Lacey's Downline chat alongside your own team's chats." },
      { name: "FLC call recordings", text: "Every recording open to Lacey's downline appears in your Calls tab automatically, and new ones keep arriving. Switch them off if you don't want them." },
      { name: "FLC calendar", text: "Upcoming FLC calls show in the same calendar as the calls you add, so every call is in one place. Switch them off any time." },
      { name: "All FLC courses", text: "Every FLC course, including the Business Launch Course, ready for your team. Courses can't be downloaded, renamed or edited, and you choose which ones to show." },
    ],
  },
];

/** The founders price for Starter, kept for life while payments continue. */
export const FOUNDER_PRICE = 33;

type PlanHolder = { role?: string; plan?: number | null; founder?: boolean; founder_lost_at?: string | null };

/** Does this person still have the founders price? */
export const hasFounderPrice = (p: PlanHolder | null | undefined) => !!p?.founder && !p.founder_lost_at;

/** What this person pays (or would pay) for a plan: Starter is $33 for founders, everything else is the list price. */
export const priceFor = (tier: PlanTier, p: PlanHolder | null | undefined) => (tier === 47 && hasFounderPrice(p) ? FOUNDER_PRICE : tier);

/** Is this person on this plan or a higher one? Admins always are. The database checks the same with plan_at_least(). */
export const planAtLeast = (p: PlanHolder | null | undefined, min: PlanTier) => p?.role === "admin" || (p?.plan ?? 0) >= min;

/** Every plan below this one, cheapest first: what "Everything in ..." stands for. */
export const plansBelow = (tier: PlanTier) => PLANS.filter((p) => p.tier < tier);
