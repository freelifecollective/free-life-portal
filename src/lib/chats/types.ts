export const REACTIONS = [
  { kind: "like", label: "Like", icon: "👍" },
  { kind: "love", label: "Love", icon: "❤️" },
  { kind: "celebrate", label: "Celebrate", icon: "🎉" },
  { kind: "fire", label: "Fire", icon: "🔥" },
] as const;
export type ReactionKind = (typeof REACTIONS)[number]["kind"];

export const POST_MAX = 4000;
export const COMMENT_MAX = 2000;

export type ChatInfo = { id: string; section_id: number; slug: string; name: string; description: string | null; sort: number; votes_on: boolean };
export type ChatSection = { id: number; name: string; chats: ChatInfo[] };

export type Author = { id: string; name: string; username: string | null; avatar_url: string | null };
export type CommentView = { id: string; author: Author; body: string; created_at: string; mine: boolean };
export type PostView = {
  id: string;
  author: Author;
  body: string;
  created_at: string;
  edited: boolean;
  mine: boolean;
  comments: CommentView[];
  reactions: { kind: ReactionKind; count: number; mine: boolean }[];
  votes: number;
  voted: boolean;
};
