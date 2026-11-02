"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { createClient } from "@/lib/supabase/client";

type Person = { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null; year: number };

/** A thin banner at the top of the portal for paying affiliates on someone's birthday. Click it to wish them happy birthday. */
export function BirthdayBanner() {
  const [people, setPeople] = useState<Person[]>([]);
  useEffect(() => {
    let live = true;
    const d = new Date();
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; // the viewer's own date
    void (async () => {
      try {
        const { data } = await createClient().rpc("birthdays_today", { p_day: day });
        if (live) setPeople((data ?? []) as Person[]);
      } catch { /* no banner */ }
    })();
    return () => { live = false; };
  }, []);
  if (people.length === 0) return null;
  return (
    <div className="bday-bar" role="region" aria-label="Birthdays today">
      {people.map((p) => {
        const name = [p.first_name, p.last_name].filter(Boolean).join(" ");
        return (
          <Link key={p.id} href={`/birthday/${p.id}?y=${p.year}`} className="bday-item">
            <Avatar url={p.avatar_url} initials={((p.first_name ?? "").charAt(0) + (p.last_name ?? "").charAt(0)).toUpperCase() || "?"} size={30} label={name} />
            <span>{`It's ${name}'s birthday today, wish them a Happy Birthday! 🎂`}</span>
          </Link>
        );
      })}
    </div>
  );
}
