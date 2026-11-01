"use client";

import { useState, useSyncExternalStore } from "react";
import { EMOJI_CATEGORIES } from "@/lib/chats/emoji";

/* the emoji you use most are remembered on this device and shown first, like on a phone */
const KEY = "flc_emoji_use";
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => { listeners.add(cb); window.addEventListener("storage", cb); return () => { listeners.delete(cb); window.removeEventListener("storage", cb); }; };
const read = () => { try { return localStorage.getItem(KEY) ?? "{}"; } catch { return "{}"; } };
function parse(raw: string): Record<string, number> { try { const v = JSON.parse(raw); return v && typeof v === "object" ? v : {}; } catch { return {}; } }
function remember(emoji: string) {
  const use = parse(read());
  use[emoji] = (use[emoji] ?? 0) + 1;
  const top = Object.entries(use).sort((a, b) => b[1] - a[1]).slice(0, 60);
  try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(top))); } catch { /* it still works without being remembered */ }
  listeners.forEach((l) => l());
}

const RECENT = { id: "recent", icon: "🕘", name: "Frequently used" };

/** Emoji in tabs: frequently used first, then smileys, animals, food, travel, activities, objects, symbols and flags. */
export function EmojiPicker({ onPick, selected, className = "" }: { onPick: (emoji: string) => void; selected?: string | null; className?: string }) {
  const raw = useSyncExternalStore(subscribe, read, () => "{}");
  const frequent = Object.entries(parse(raw)).sort((a, b) => b[1] - a[1]).slice(0, 32).map(([e]) => e);
  const [picked, setPicked] = useState<string | null>(null);
  const cat = picked ?? (frequent.length ? RECENT.id : EMOJI_CATEGORIES[0].id);
  const tabs = [...(frequent.length ? [RECENT] : []), ...EMOJI_CATEGORIES.map(({ id, icon, name }) => ({ id, icon, name }))];
  const list = cat === RECENT.id ? frequent : (EMOJI_CATEGORIES.find((c) => c.id === cat) ?? EMOJI_CATEGORIES[0]).list;
  const name = tabs.find((t) => t.id === cat)?.name ?? "";
  return (
    <div className={"emo " + className}>
      <div className="emo-tabs" role="tablist" aria-label="Emoji categories">
        {tabs.map((c) => (
          <button key={c.id} type="button" role="tab" aria-selected={c.id === cat} aria-label={c.name} title={c.name} className={c.id === cat ? "on" : ""} onClick={() => setPicked(c.id)}>{c.icon}</button>
        ))}
      </div>
      <div className="emo-grid" role="group" aria-label={name}>
        {list.map((e) => <button key={e} type="button" className={e === selected ? "on" : ""} aria-label={e} onClick={() => { remember(e); onPick(e); }}>{e}</button>)}
      </div>
    </div>
  );
}
