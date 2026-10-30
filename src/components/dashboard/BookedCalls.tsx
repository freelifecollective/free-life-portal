"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeBookedCall } from "@/app/(app)/booked-calls/actions";
import { Avatar } from "@/components/Avatar";
import { TrashButton } from "@/components/tasks/TrashButton";

export type BookedCall = { id: string; lead_name: string; when: string; closer: { name: string; photo_url: string | null } | null };

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("") || "?";

/** "Coaching Calls Booked": the calls coming up with leads and who is taking each one. Bookings will arrive here on their own once leads can book. */
export function BookedCalls({ calls }: { calls: BookedCall[] }) {
  const router = useRouter();
  const [pending, run] = useTransition();

  return (
    <section className="home-card booked" aria-label="Coaching calls booked">
      <div className="booked-head">
        <div><span className="hs-label">Coaching Calls Booked</span><span className="hs-big">{calls.length}</span></div>
      </div>
      {calls.length === 0 ? (
        <p className="when" style={{ margin: 0 }}>No coaching calls booked yet. When a lead books a call, it will appear here with who is taking it.</p>
      ) : (
        <ul className="booked-list">
          {calls.map((c) => (
            <li key={c.id}>
              <div className="booked-main">
                <strong>{c.lead_name}</strong>
                <span className="when">{c.when}</span>
              </div>
              {c.closer ? (
                <div className="booked-closer" title={`${c.closer.name} is taking this call`}>
                  <Avatar url={c.closer.photo_url} initials={initials(c.closer.name)} size={38} label={c.closer.name} />
                  <span><small>Call closer</small><strong>{c.closer.name}</strong></span>
                </div>
              ) : <span className="when">You are taking this call</span>}
              <TrashButton label={c.lead_name} busy={pending} onConfirm={() => run(async () => { await removeBookedCall(c.id); router.refresh(); })} />
            </li>
          ))}
        </ul>
      )}

    </section>
  );
}
