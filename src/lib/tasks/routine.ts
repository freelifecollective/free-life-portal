import type { Area, Repeat } from "./schedule";

export type RoutineItem = { group: string; title: string; note: string; area: Area; repeat: Repeat };
const d = (group: string, area: Area, title: string, note = ""): RoutineItem => ({ group, area, title, note, repeat: "daily" });
const w = (group: string, area: Area, title: string, note = ""): RoutineItem => ({ group, area, title, note, repeat: "weekly" });

/** The recommended routine people can start their task list from (daily things repeat every day, the weekly ones every week). Titles with "morning" or "follow up" count toward the streaks. */
const SPIRITUAL: RoutineItem[] = [
  d("Mindset work", "personal", "Write down 5 goals for the week"),
  d("Mindset work", "personal", "Write 5-10 things you are grateful for, and why"),
  d("Mindset work", "personal", "Tapping"),
  d("Mindset work", "personal", "10-20 minute meditation"),
  d("Mindset work", "personal", "Visualize your dream life"),
  d("Mindset work", "personal", "Manifestation challenge"),
  d("Mindset work", "personal", "Abraham Hicks audio or 10 minutes of affirmations"),
  d("Business actions", "business", "Check in on ads and track your numbers", "Leads, webclass views and weekly ad spend."),
  d("Business actions", "business", "Follow up with at least 15 leads", "Work your way up to 15. This is not expected right away."),
  w("Business actions", "business", "Post on your feed 3 times this week"),
  w("Business actions", "business", "Post value on stories 4 times this week", "Inspire, motivate, educate."),
  d("Business actions", "business", "Talk in your stories"),
  w("Business actions", "business", "Post a win"),
  d("Business actions", "business", "Engage for at least 15 minutes", "Ideally before you post."),
  d("Continued learning", "business", "Accountability buddy check-up"),
  d("Continued learning", "business", "Watch a mastermind, team call or other training recording"),
  d("Continued learning", "business", "Show up to a mastermind or call live"),
  d("Continued learning", "business", "Listen to a podcast"),
  d("Continued learning", "business", "Share a daily win with your accountability buddy or team"),
  d("Personal growth", "personal", "Wake up at 5:30am"),
  d("Personal growth", "personal", "30 minutes of exercise or activity"),
  d("Personal growth", "personal", "Turn off your phone 30 minutes before bed"),
  d("Personal growth", "personal", "30 minutes of reading"),
  w("Personal growth", "business", "Develop leadership skills", "Volunteer for a mastermind, do leadership reading, host a call."),
  w("Highly recommended", "business", "Organize your week before Monday"),
  w("Highly recommended", "business", "Write your social media content in advance"),
  w("Highly recommended", "personal", "Weekly reflection"),
  w("Highly recommended", "business", "Plan your Instagram stories in advance"),
];

const FAITH_MINDSET: RoutineItem[] = [
  d("Faith and mindset", "personal", "Morning prayer and quiet time with God"),
  d("Faith and mindset", "personal", "Read scripture for 10-20 minutes"),
  d("Faith and mindset", "personal", "Write down 5 goals for the week and pray over them"),
  d("Faith and mindset", "personal", "Write 5-10 things you are thankful to God for, and why"),
  d("Faith and mindset", "personal", "Listen to worship music or a devotional"),
  d("Faith and mindset", "personal", "Pray over your business, your leads and your team"),
  d("Faith and mindset", "personal", "Speak affirmations of faith over your day"),
];
const REST = SPIRITUAL.filter((r) => r.group !== "Mindset work");

export type RoutineKey = "faith" | "spiritual";
export const ROUTINES: Record<RoutineKey, { label: string; items: RoutineItem[] }> = {
  faith: { label: "Recommended daily routine (faith-based)", items: [...FAITH_MINDSET, ...REST] },
  spiritual: { label: "Recommended daily routine (spiritual)", items: SPIRITUAL },
};
