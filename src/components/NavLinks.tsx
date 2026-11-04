"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useSyncExternalStore } from "react";
import { LiveDot } from "./LiveBadge";

export type NavEntry = { label: string; href?: string; heading?: boolean; caption?: boolean; group?: string; badge?: number; live?: boolean; locked?: boolean };

/* Only one section is open at a time. Each device remembers which one (or "none"), under its own key. */
const KEY = "flc_nav_open";
const ADMIN_KEY = "flc_nav_admin";   /* the whole Admin block: "open" or "closed" */
const NONE = "none";
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => { listeners.add(cb); window.addEventListener("storage", cb); return () => { listeners.delete(cb); window.removeEventListener("storage", cb); }; };
const readKey = (key: string) => () => { try { return localStorage.getItem(key) ?? ""; } catch { return ""; /* storage may be blocked */ } };
const read = readKey(KEY);
const readAdmin = readKey(ADMIN_KEY);
function rememberKey(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* not saved, still works this visit */ }
  listeners.forEach((l) => l());
}
const remember = (value: string) => rememberKey(KEY, value);

function Item({ n, path, onLocked }: { n: NavEntry; path: string; onLocked: () => void }) {
  if (n.locked) {
    return (
      <li data-nav={n.label} className={n.group ? "nav-sub" : undefined}>
        <button type="button" className="nav-locked" aria-haspopup="dialog" onClick={onLocked}><span>{n.label}</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg><span className="sr-only">(locked)</span></button>
      </li>
    );
  }
  if (!n.href) return <li data-nav={n.label} className={n.group ? "nav-sub" : undefined}><span title="Coming soon">{n.label}</span></li>;
  const active = n.href === "/" ? path === "/" : path === n.href || path.startsWith(n.href + "/");
  return (
    <li data-nav={n.label} className={n.group ? "nav-sub" : undefined}>
      <Link href={n.href} aria-current={active ? "page" : undefined}>{n.label}{n.live ? <LiveDot /> : null}{n.badge ? <span className="badge" aria-label={`${n.badge} waiting`}>{n.badge}</span> : null}</Link>
    </li>
  );
}

/**
 * The left-hand menu. The page you are on is highlighted; pages that do not exist yet are greyed out.
 * Every section heading folds its tabs away. Only one section is open at a time, and the choice is remembered on this device.
 */
export function NavLinks({ items }: { items: NavEntry[] }) {
  const path = usePathname();
  const lockDlg = useRef<HTMLDialogElement>(null);
  const onLocked = () => lockDlg.current?.showModal();
  const saved = useSyncExternalStore(subscribe, read, () => "");
  const savedAdmin = useSyncExternalStore(subscribe, readAdmin, () => "");
  const on = (n: NavEntry) => !!n.href && (n.href === "/" ? path === "/" : path === n.href || path.startsWith(n.href + "/"));
  const sections = items.filter((g) => g.heading).map((g) => g.label);
  /* until someone chooses, the section holding the page they are on is open, otherwise the first one */
  const open = saved && (saved === NONE || sections.includes(saved)) ? saved : sections.find((l) => items.some((g) => g.group === l && !g.heading && on(g))) ?? sections[0] ?? NONE;
  const isOpen = (label: string) => open === label;
  const waiting = (label: string) => items.filter((g) => g.group === label && !g.heading).reduce((n, g) => n + (g.badge ?? 0), 0);

  /* Home and Chats first, then each section with its tabs, then the tabs that are not in a section */
  const section = (label: string) => {
    const opened = isOpen(label);
    const w = waiting(label);
    const kids = items.filter((g) => g.group === label && !g.heading);
    return (
      <li key={label} className={"nav-section" + (opened ? " open" : "")} data-nav={label}>
        <button type="button" className="nav-toggle" aria-expanded={opened} onClick={() => remember(opened ? NONE : label)}>
          <span>{label}</span>
          <span className="nav-toggle-right">
            {!opened && w ? <span className="badge" aria-label={`${w} waiting`}>{w}</span> : null}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: opened ? "rotate(180deg)" : undefined, transition: "transform .15s" }}><path d="M6 9l6 6 6-6" /></svg>
          </span>
        </button>
        {opened ? <ul className="nav-kids">{kids.map((n) => <Item key={n.label} n={n} path={path} onLocked={onLocked} />)}</ul> : null}
      </li>
    );
  };

  /* everything after the "Admin only" caption is the Admin block: it folds away as a whole, and its sections fold as usual */
  const capAt = items.findIndex((g) => g.caption);
  const main = capAt < 0 ? items : items.slice(0, capAt);
  const adminItems = capAt < 0 ? [] : items.slice(capAt + 1);
  const adminOpen = savedAdmin ? savedAdmin === "open" : items.some((g) => g.group && on(g) && adminItems.includes(g)) || adminItems.some((g) => !g.heading && on(g));
  const row = (n: NavEntry) => (n.heading ? section(n.label) : n.group ? null : <Item key={n.label} n={n} path={path} onLocked={onLocked} />);

  return (
    <>
      <ul>
        {main.map(row)}
        {capAt >= 0 ? (
          <li className={"nav-caption nav-admin" + (adminOpen ? " open" : "")} data-nav={items[capAt].label}>
            <button type="button" className="nav-admin-toggle" aria-expanded={adminOpen} onClick={() => rememberKey(ADMIN_KEY, adminOpen ? "closed" : "open")}>
              <span>{items[capAt].label}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: adminOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }}><path d="m6 9 6 6 6-6" /></svg>
            </button>
          </li>
        ) : null}
        {adminOpen ? adminItems.map(row) : null}
      </ul>
      <dialog ref={lockDlg} className="rs-dialog" aria-labelledby="locked-title">
        <h2 id="locked-title" className="qh" style={{ marginTop: 0 }}>Members only</h2>
        <p>Sorry, this feature is only available to paying members.</p>
        <div className="dlg-actions">
          <button type="button" className="btn" onClick={() => lockDlg.current?.close()}>Close</button>
          <Link className="btn primary" href="/plans" style={{ textDecoration: "none" }} onClick={() => lockDlg.current?.close()}>See the plans</Link>
        </div>
      </dialog>
      {/* never shown: it holds every name, folded away or not, so the menu is always wide enough for all of them in this language */}
      <ul className="nav-sizer" aria-hidden="true">
        {items.map((n) => {
          /* what could sit beside the name: a number badge, or a section arrow */
          const extra = n.heading ? "sz-h" : n.href === "/messages" || !!n.href?.startsWith("/admin/") ? "sz-badge" : "";
          return <li key={n.label}><span className={[extra, n.group && !n.heading ? "sz-sub" : ""].join(" ").trim() || undefined}>{n.label}</span></li>;
        })}
      </ul>
    </>
  );
}
