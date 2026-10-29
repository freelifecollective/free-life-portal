"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";

/** Your picture at the top right. Click it for your settings and to sign out. */
export function UserMenu({ url, initials, preview, label, showSubscription }: { url: string | null; initials: string; preview: boolean; label: string; showSubscription: boolean }) {
  const path = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === path; // changing page closes it
  const box = useRef<HTMLDivElement>(null);
  const logoutDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => { if (!box.current?.contains(e.target as Node)) setOpenAt(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenAt(null); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("touchstart", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div className="user-menu" ref={box}>
      <button type="button" className="avatar-link" data-tour="account" aria-haspopup="menu" aria-expanded={open} aria-label="Your account menu" onClick={() => setOpenAt(open ? null : path)}>
        <Avatar url={url} initials={initials} preview={preview} label={label} />
      </button>
      {open ? (
        <div className="user-pop" role="menu">
          <Link href="/settings" role="menuitem">Profile</Link>
          {showSubscription ? <Link href="/settings/subscription" role="menuitem">My Subscription</Link> : null}
          <Link href="/settings/app" role="menuitem">Get the App</Link>
          <button type="button" role="menuitem" onClick={() => { setOpenAt(null); window.dispatchEvent(new Event("flc:tour")); }}>Take the tour</button>
          <button type="button" role="menuitem" onClick={() => { setOpenAt(null); logoutDialog.current?.showModal(); }}>Log out</button>
        </div>
      ) : null}
      <dialog ref={logoutDialog} className="rs-dialog" aria-labelledby="logout-title">
        <h2 id="logout-title" className="qh" style={{ marginTop: 0 }}>Log out</h2>
        <p>Are you sure you want to log out from the portal?</p>
        <form action="/logout" method="post" className="dlg-actions">
          <button type="button" className="btn" onClick={() => logoutDialog.current?.close()}>Cancel</button>
          <button type="submit" className="btn primary">Log out</button>
        </form>
      </dialog>
    </div>
  );
}
