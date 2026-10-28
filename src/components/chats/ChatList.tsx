import Link from "next/link";
import type { ChatSection } from "@/lib/chats/types";

/** Sections with bold headings, each listing its chats. The chat you are in is highlighted. */
export function ChatList({ sections, current }: { sections: ChatSection[]; current: string }) {
  return (
    <nav className="chat-list" aria-label="Chats">
      {sections.map((s) => (
        <section key={s.id}>
          <h2 className="chat-section">{s.name}</h2>
          <ul>
            {s.chats.map((c) => (
              <li key={c.id}><Link href={`/chats/${c.slug}`} aria-current={c.slug === current ? "page" : undefined}>{c.name}</Link></li>
            ))}
          </ul>
        </section>
      ))}
      <Link className="chat-answers" href="/responses">How to respond to leads</Link>
    </nav>
  );
}
