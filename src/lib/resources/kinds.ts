export type ResourceCategory = "books" | "media" | "products" | "canva";
export type ResourceSection = "resources" | "advertising";

/** The link tabs, with the menu section each one lives in. */
export const RESOURCE_TABS: { category: ResourceCategory; section: ResourceSection; slug: string; label: string; lede: string }[] = [
  { category: "books", section: "resources", slug: "books", label: "Books", lede: "Books we recommend reading." },
  { category: "products", section: "resources", slug: "product-information", label: "Product Information", lede: "Everything you need to know about the products." },
  { category: "media", section: "advertising", slug: "pictures-videos", label: "Pictures/Videos", lede: "Pictures and videos you can use and share." },
  { category: "canva", section: "advertising", slug: "canva-templates", label: "Canva Templates", lede: "Templates you can open and make your own in Canva." },
];
export const bySlug = (slug: string) => RESOURCE_TABS.find((t) => t.slug === slug);
export const hrefOfTab = (t: { section: ResourceSection; slug: string }) => `/${t.section}/${t.slug}`;

/** Evidence Manual: ranks from highest to lowest, and the kinds of story an admin can choose from. */
export const RANKS = ["6A2-8", "6A2-7", "6A2-6", "6A2-5", "6A2-4", "6A2-3", "6A2-2", "6A2", "6A"] as const;
export const STORY_TYPES: [string, string][] = [
  ["single_mom", "Single mom"], ["mom_of_multiples", "Mom to multiples"], ["was_corporate", "Was in corporate"],
  ["was_homeless", "Was homeless"], ["was_in_jail", "Was in jail"], ["was_sick", "Was sick"],
  ["stay_at_home", "Stay-at-home parent"], ["was_in_debt", "Was in debt"], ["other", "Other"],
];
export const storyLabel = (k: string) => STORY_TYPES.find(([v]) => v === k)?.[1] ?? "Other";
