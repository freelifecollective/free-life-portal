/** Telegram-style: "online", "last seen 5 minutes ago", "last seen today at 7:45 PM", "last seen yesterday at ...", "last seen Oct 12". */
export function lastSeen(iso: string): { text: string; online: boolean } {
  const then = new Date(iso), now = new Date();
  const mins = Math.floor((now.getTime() - then.getTime()) / 60000);
  if (mins < 2) return { text: "online", online: true };
  if (mins < 60) return { text: `last seen ${mins} ${mins === 1 ? "minute" : "minutes"} ago`, online: false };
  if (mins < 12 * 60) { const h = Math.floor(mins / 60); return { text: `last seen ${h} ${h === 1 ? "hour" : "hours"} ago`, online: false }; }
  const clock = then.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime()) / 86400000);
  if (days <= 0) return { text: `last seen today at ${clock}`, online: false };
  if (days === 1) return { text: `last seen yesterday at ${clock}`, online: false };
  return { text: `last seen ${then.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, online: false };
}
