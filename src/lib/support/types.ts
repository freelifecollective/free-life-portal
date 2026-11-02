export type SupportHit = { kind: "resource" | "recording" | "lesson" | "document" | "call"; id: string; parent: string | null; title: string; blurb: string; url: string | null; at: string | null; rank: number; /** for a recommended resource: book, website, … */ sub: string | null; /** a past call's picture */ thumb: string | null; /** how many people left feedback on the call */ reviews: number };

export const RESOURCE_KINDS = ["book", "website", "video", "podcast", "document", "other"] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];
export const KIND_LABEL: Record<ResourceKind, string> = { book: "Book", website: "Website", video: "Video", podcast: "Podcast", document: "Document", other: "Other" };

/** The groups on the results page, in the order they are shown. */
export const GROUPS: { kind: SupportHit["kind"]; title: string }[] = [
  { kind: "call", title: "Calls to join" },
  { kind: "recording", title: "Watch one of these past calls" },
  { kind: "lesson", title: "Lessons in the classroom" },
  { kind: "document", title: "Documents" },
];

/** Where each kind of result opens. */
export function hrefOf(h: SupportHit): string | null {
  switch (h.kind) {
    case "call": return "/calendar";
    case "recording": return `/calls/${h.id}`;
    case "lesson": return h.parent ? `/classroom/${h.parent}` : "/classroom";
    case "document": return `/documents/open/${h.id}`;
    case "resource": return h.url;
  }
}

export type SupportPerson = { id: string; first_name: string | null; last_name: string | null; username: string | null };
export type SupportPeople = { coach: SupportPerson | null; buddy: SupportPerson | null };
