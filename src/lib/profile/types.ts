import type { Role } from "@/lib/roles";

export type AvatarKind = "upload" | "generated" | "monogram";
export const AVATAR_KINDS: AvatarKind[] = ["upload", "generated", "monogram"];

export type Profile = {
  id: string;
  call_closer?: boolean;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  instagram: string | null;
  facebook: string | null;
  avatar_url: string | null;
  avatar_kind: AvatarKind | null;
  role: Role;
  onboarded_at: string | null;
  removed_at?: string | null;
  /** paid plan tier (47, 97 or 297), null when not paying */
  plan?: number | null;
  /** joined at the $33 founders price */
  founder?: boolean;
  /** when the founders price ended (missed payments or cancelling) */
  founder_lost_at?: string | null;
  /** part of Lacey's Downline */
  lacey_downline?: boolean;
};

export type AppSession = {
  mode: "supabase" | "preview";
  user: { id: string; email: string | null };
  profile: Profile;
};
