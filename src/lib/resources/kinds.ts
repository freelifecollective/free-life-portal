export type ResourceCategory = "books" | "media" | "products" | "canva";

/** The four Resources tabs, in the order they are shown in the menu. */
export const RESOURCE_TABS: { category: ResourceCategory; slug: string; label: string; lede: string }[] = [
  { category: "books", slug: "books", label: "Books", lede: "Books we recommend reading." },
  { category: "media", slug: "pictures-videos", label: "Pictures/Videos", lede: "Pictures and videos you can use and share." },
  { category: "products", slug: "product-information", label: "Product Information", lede: "Everything you need to know about the products." },
  { category: "canva", slug: "canva-templates", label: "Canva Templates", lede: "Templates you can open and make your own in Canva." },
];
export const bySlug = (slug: string) => RESOURCE_TABS.find((t) => t.slug === slug);
