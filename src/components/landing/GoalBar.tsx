"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const POLL_MS = 20_000;

/**
 * A tall "charity thermometer": it fills from the bottom as people register for the next call.
 * Every open page listens to the same counter, so all of them move together. If live updates are
 * blocked, the page asks again every 20 seconds.
 */
export function GoalBar({ callId, initial, goal }: { callId: string; initial: number; goal: number }) {
  const [count, setCount] = useState(initial);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`call-stats-${callId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "call_stats", filter: `call_id=eq.${callId}` }, (payload) => {
        const n = (payload.new as { registered?: number } | null)?.registered;
        if (typeof n === "number") setCount(n);
      })
      .subscribe();
    const poll = async () => {
      const { data } = await supabase.from("call_stats").select("registered").eq("call_id", callId).maybeSingle();
      if (data && typeof data.registered === "number") setCount(data.registered);
    };
    const timer = window.setInterval(poll, POLL_MS);
    return () => { window.clearInterval(timer); void supabase.removeChannel(channel); };
  }, [callId]);

  const pct = Math.min(100, (count / goal) * 100);
  const shown = count > 0 ? Math.max(pct, 3) : 0;
  const reached = count >= goal;
  const marks = [0.25, 0.5, 0.75].map((m) => Math.round(goal * m));

  return (
    <figure className="goal" aria-label="Registrations so far">
      <div className="goal-top">{goal}</div>
      <div className="goal-track" role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(count, goal)} aria-valuetext={`${count} of ${goal} spots claimed`}>
        <div className="goal-fill" style={{ height: `${shown}%` }} />
        {marks.map((m) => <span key={m} className="goal-mark" style={{ bottom: `${(m / goal) * 100}%` }}><i />{m}</span>)}
      </div>
      <figcaption className="goal-caption">
        <span className="goal-num" aria-live="polite">{count}</span>
        <span>{reached ? "goal reached, thank you!" : `of ${goal} spots claimed`}</span>
      </figcaption>
    </figure>
  );
}
