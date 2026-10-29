"use client";

import { useEffect, useRef } from "react";

/** Sends the hidden form on by itself as soon as the page is open, so nobody has to press anything. */
export function AutoSubmit({ tokenHash, type, next }: { tokenHash: string; type: string; next: string }) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { form.current?.requestSubmit(); }, []);
  return (
    <form ref={form} method="post" action="/auth/verify">
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="next" value={next} />
      <noscript><button className="btn primary" type="submit">Enter the portal</button></noscript>
    </form>
  );
}
