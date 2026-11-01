import type { Role } from "@/lib/roles";

export const POST_MAX = 4000;
export const COMMENT_MAX = 2000;

export type ChatInfo = { id: string; section_id: number; slug: string; name: string; description: string | null; sort: number; votes_on: boolean; min_role: Role; description_lead: string | null;
  posting: "all" | "admins"; replies_allowed: boolean; show_views: boolean; divider_after: boolean; mode?: "feed" | "conversation" };
export type ChatSection = { id: number; name: string; min_role: Role; chats: ChatInfo[] };

export type Author = { id: string; name: string; username: string | null; avatar_url: string | null; is_admin: boolean };
export type CommentView = { id: string; author: Author; body: string; created_at: string; mine: boolean };
export type PostView = {
  id: string;
  author: Author;
  body: string;
  created_at: string;
  edited: boolean;
  audio_url?: string | null;
  audio_secs?: number | null;
  pinned: boolean;
  mine: boolean;
  comments: CommentView[];
  /** One entry per emoji that was used, most popular first. */
  reactions: { emoji: string; count: number; people: { name: string; at: string }[] }[];
  myReaction: string | null;
  votes: number;
  voted: boolean;
  views: number;
};
