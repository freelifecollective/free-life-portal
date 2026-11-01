"use client";

import { useState } from "react";
import { EMOJI_CATEGORIES } from "@/lib/chats/emoji";

/** Emoji in tabs: smileys, animals, food, travel, activities, objects, symbols and flags. */
export function EmojiPicker({ onPick, selected, className = "" }: { onPick: (emoji: string) => void; selected?: string | null; className?: string }) {
  const [cat, setCat] = useState(EMOJI_CATEGORIES[0].id);
  const current = EMOJI_CATEGORIES.find((c) => c.id === cat) ?? EMOJI_CATEGORIES[0];
  return (
    <div className={"emo " + className}>
      <div className="emo-tabs" role="tablist" aria-label="Emoji categories">
        {EMOJI_CATEGORIES.map((c) => (
          <button key={c.id} type="button" role="tab" aria-selected={c.id === cat} aria-label={c.name} title={c.name} className={c.id === cat ? "on" : ""} onClick={() => setCat(c.id)}>{c.icon}</button>
        ))}
      </div>
      <div className="emo-grid" role="group" aria-label={current.name}>
        {current.list.map((e) => <button key={e} type="button" className={e === selected ? "on" : ""} aria-label={e} onClick={() => onPick(e)}>{e}</button>)}
      </div>
    </div>
  );
}
