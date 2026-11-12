import Link from "next/link";

const TABS = [
  { href: "/advertising/funnels", label: "Funnels" },
  { href: "/advertising/funnels/forms", label: "Forms" },
  { href: "/advertising/funnels/automations", label: "Automations" },
  { href: "/advertising/funnels/emails", label: "Emails" },
];

/** The bubbles at the top of the Funnels tab, like the ones in Chats. */
export function FunnelTabs({ current }: { current: string }) {
  return (
    <nav aria-label="Funnels" className="chat-bar fn-tabs">
      <ul className="chat-pills">
        {TABS.map((t) => (
          <li key={t.href}><Link href={t.href} className="chat-pill" aria-current={t.href === current ? "page" : undefined}>{t.label}</Link></li>
        ))}
      </ul>
    </nav>
  );
}
