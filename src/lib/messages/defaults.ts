/*
 * The ready-made emails and texts every Builder and Leader starts with. They can use them as they are or change them.
 * {first_name}, {last_name} and {email} become the person's own details when sent.
 * Rules, as on the landing page: never name the company or its products, and make no promise of income.
 */
export type DefaultMessage = { key: string; kind: "email" | "text"; name: string; subject?: string; body: string };

export const DEFAULT_MESSAGES: DefaultMessage[] = [
  {
    key: "welcome", kind: "email", name: "Welcome", subject: "Welcome, {first_name}!",
    body: "Hi {first_name},\n\nThank you for signing up. I'm so glad you're here.\n\nTake a few minutes to watch the video when you can. It explains everything far better than I could in an email.\n\nIf you have any questions at all, just reply to this email. I read every one.",
  },
  {
    key: "did_you_watch", kind: "email", name: "Did you watch?", subject: "Did you get a chance to watch, {first_name}?",
    body: "Hi {first_name},\n\nJust checking in. Did you get a chance to watch the video yet?\n\nI'd love to hear what you thought, even if it's just a sentence or two. Reply here and tell me what stood out to you.",
  },
  {
    key: "book_a_call", kind: "email", name: "Invite to a call", subject: "Want to hop on a quick call?",
    body: "Hi {first_name},\n\nIf you're curious about what this could look like for you, the easiest next step is a short call together.\n\nThere's no pressure at all. It's simply a chance to ask your questions and hear how it works.\n\nReply to this email with a couple of times that suit you and I'll set it up.",
  },
  { key: "text_welcome", kind: "text", name: "Welcome text", body: "Hi {first_name}! Thanks for signing up. Keep an eye on your inbox, I've just sent you everything you need." },
  { key: "text_check_in", kind: "text", name: "Check-in text", body: "Hi {first_name}, did you get a chance to watch the video? I'd love to hear what you thought!" },
  { key: "text_call", kind: "text", name: "Call invite text", body: "Hi {first_name}, would you like to hop on a quick call this week? Happy to answer any questions." },
];
