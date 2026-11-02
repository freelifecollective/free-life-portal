"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Shown above a conversation with a lead who belongs to another affiliate. */
export function LeadWarning({ otherId }: { otherId: string }) {
  const [warn, setWarn] = useState(false);
  useEffect(() => {
    let live = true;
    void createClient().rpc("message_lead_warning", { p_other: otherId }).then(({ data }) => { if (live) setWarn(data === true); });
    return () => { live = false; };
  }, [otherId]);
  if (!warn) return null;
  return <p className="lead-warn" role="note">This lead belongs to another affiliate. Reaching out to someone else&apos;s lead is lead poaching, and anyone found doing it is removed from the community permanently.</p>;
}
