"use client";

import { useEffect, useRef } from "react";

/** The row of chat buttons. The buttons keep their normal size; this only decides where each row ends so the rows come out even (never 7 + 1). */
export function BalancedPills({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const ul = ref.current;
    if (!ul) return;
    const GAP = 8;
    const balance = () => {
      const items = Array.from(ul.children) as HTMLElement[];
      items.forEach((li) => { li.style.marginRight = ""; });
      const avail = ul.clientWidth;
      const w = items.map((li) => li.getBoundingClientRect().width);
      const total = w.reduce((a, b) => a + b, 0) + GAP * Math.max(0, items.length - 1);
      const rows = Math.max(1, Math.ceil(total / Math.max(avail, 1)));
      if (rows < 2) return;
      const target = total / rows;
      let used = 0;
      items.forEach((li, i) => {
        const next = w[i + 1];
        used += w[i] + (used ? GAP : 0);
        if (next === undefined) return;
        const overflow = used + GAP + next > avail;
        const closer = Math.abs(used - target) <= Math.abs(used + GAP + next - target);
        if (overflow || closer) { li.style.marginRight = `${Math.max(0, avail - used - 1)}px`; used = 0; }
      });
    };
    balance();
    const ro = new ResizeObserver(balance);
    ro.observe(ul);
    return () => ro.disconnect();
  }, [children]);
  return <ul className="chat-pills" aria-label={label} ref={ref}>{children}</ul>;
}
