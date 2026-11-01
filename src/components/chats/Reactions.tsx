"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { setReaction } from "@/app/(app)/chats/actions";
import { EMOJI, QUICK_REACTION } from "@/lib/chats/emoji";
import type { PostView } from "@/lib/chats/types";
import { formatInZone } from "@/lib/time";

type Summary = PostView["reactions"];

/** Facebook-style: hover (or tap) the thumb to pick any emoji. Chosen emoji sit below with counts; hover them for who and when. */
export function Reactions({ postId, slug, reactions, mine, onError }: {
  postId: string; slug: string; reactions: Summary; mine: string | null; onError: (m: string) => void;
}) {
  const [, start] = useTransition();
  const [state, setState] = useOptimistic({ reactions, mine }, (cur, next: string | null) => {
    const list = cur.reactions
      .map((r) => (r.emoji === cur.mine ? { ...r, count: r.count - 1 } : r))
      .filter((r) => r.count > 0);
    if (next) {
      const hit = list.find((r) => r.emoji === next);
      if (hit) hit.count += 1; else list.push({ emoji: next, count: 1, people: [] });
    }
    return { reactions: list, mine: next };
  });
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  /* the picker floats over the page (not inside the scrolling chat) so none of it is cut off */
  const show = () => { const r = wrap.current?.getBoundingClientRect(); if (r) setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - 348)), bottom: window.innerHeight - r.top }); setOpen(true); };
  const [tip, setTip] = useState<string | null>(null);

  function choose(emoji: string | null) {
    setOpen(false);
    onError("");
    start(async () => {
      setState(emoji);
      const r = await setReaction(postId, slug, emoji);
      if (!r.ok) onError(r.error ?? "That did not work.");
    });
  }

  return (
    <div className="rx">
      <div className="rx-pick" ref={wrap} onMouseEnter={show} onMouseLeave={() => setOpen(false)} onFocus={show} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
        <button type="button" className={"react" + (state.mine ? " on" : "")} aria-haspopup="true" aria-expanded={open}
          aria-label={state.mine ? `You reacted ${state.mine}. Press to take it back` : "React"}
          onClick={() => choose(state.mine ? null : QUICK_REACTION)}>
          <span aria-hidden="true">{state.mine ?? "👍"}</span>
        </button>
        {open ? (
          <div className="rx-panel" role="group" aria-label="Choose a reaction" style={pos ? { position: "fixed", left: pos.left, bottom: pos.bottom, top: "auto" } : undefined}>
            {EMOJI.map((e) => (
              <button key={e} type="button" className={e === state.mine ? "on" : ""} aria-label={e} onClick={() => choose(e === state.mine ? null : e)}>{e}</button>
            ))}
          </div>
        ) : null}
      </div>
      {state.reactions.map((r) => (
        <span key={r.emoji} className="rx-chip" onMouseEnter={() => setTip(r.emoji)} onMouseLeave={() => setTip(null)} onFocus={() => setTip(r.emoji)} onBlur={() => setTip(null)}>
          <button type="button" className={"react" + (r.emoji === state.mine ? " on" : "")} aria-label={`${r.emoji} ${r.count}. See who reacted`} onClick={() => setTip(tip === r.emoji ? null : r.emoji)}>
            <span aria-hidden="true">{r.emoji}</span><span className="n">{r.count}</span>
          </button>
          {tip === r.emoji && r.people.length ? (
            <ul className="rx-tip" role="tooltip">
              {r.people.map((p, i) => <li key={i}><strong>{p.name}</strong><span>{formatInZone(new Date(p.at))}</span></li>)}
            </ul>
          ) : null}
        </span>
      ))}
    </div>
  );
}
