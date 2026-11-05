/* The paid plans. These words are placeholders until the tiers are written: change them here and the sales page updates. */
export type PlanTier = 47 | 97 | 297;
export const PLAN_TIERS: PlanTier[] = [47, 97, 297];
export const isPlanTier = (n: unknown): n is PlanTier => PLAN_TIERS.includes(n as PlanTier);

export const PLANS: { tier: PlanTier; name: string; blurb: string; features: string[]; popular?: boolean }[] = [
  { tier: 47, name: "Starter", blurb: "Everything you need to begin.", features: ["Full access to the Free Life Collective portal", "Your own landing page", "Community chats and live calls", "What else is included: coming soon"] },
  { tier: 97, name: "Builder", blurb: "More support as you grow.", popular: true, features: ["Everything in Starter", "More tools and training", "What else is included: coming soon"] },
  { tier: 297, name: "Leader", blurb: "The full experience.", features: ["Everything in Builder", "The most support and the most tools", "What else is included: coming soon"] },
];
