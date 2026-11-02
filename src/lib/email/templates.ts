import { formatInZone } from "@/lib/time";

export type Rendered = { subject: string; html: string; text: string };
type Ctx = { siteUrl: string; unsubscribeUrl: string | null };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function shell(title: string, paras: string[], cta: { label: string; url: string } | null, ctx: Ctx): Rendered {
  const body = paras.map((p) => `<p style="margin:0 0 16px;line-height:1.55">${esc(p)}</p>`).join("");
  const button = cta ? `<p style="margin:24px 0"><a href="${esc(cta.url)}" style="background:#AB9080;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:700;display:inline-block">${esc(cta.label)}</a></p>` : "";
  const foot = ctx.unsubscribeUrl
    ? `<p style="margin:32px 0 0;font-size:12px;color:#756A64">You are getting this because you registered for a call with the Free Life Collective. <a href="${esc(ctx.unsubscribeUrl)}" style="color:#756A64">Unsubscribe</a></p>`
    : `<p style="margin:32px 0 0;font-size:12px;color:#756A64">Free Life Collective</p>`;
  const html = `<!doctype html><html><body style="margin:0;background:#F6F5F1;font-family:Helvetica,Arial,sans-serif;color:#2B2522"><div style="max-width:560px;margin:0 auto;padding:32px 20px"><h1 style="font-family:Georgia,serif;font-weight:400;font-size:26px;margin:0 0 20px">${esc(title)}</h1>${body}${button}${foot}</div></body></html>`;
  const text = [title, "", ...paras, ...(cta ? ["", `${cta.label}: ${cta.url}`] : []), "", ctx.unsubscribeUrl ? `Unsubscribe: ${ctx.unsubscribeUrl}` : "Free Life Collective"].join("\n");
  return { subject: title, html, text };
}

/** The wording of every email the portal sends. Returns null for a template we do not know. */
export function renderEmail(template: string, payload: Record<string, unknown>, ctx: Ctx): Rendered | null {
  const name = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : "there";
  const login = `${ctx.siteUrl}/login`;
  switch (template) {
    case "registration_confirmation": {
      const title = typeof payload.title === "string" ? payload.title : "your call";
      const when = typeof payload.starts_at === "string" ? formatInZone(new Date(payload.starts_at)) : "";
      return shell(`You are registered, ${name}`, [`Thank you for registering for ${title}.`, when ? `It starts ${when}.` : "", "We will see you there. A sign-in link for the portal is on its way too, so you can join the call and meet the community."].filter(Boolean), { label: "Open the portal", url: login }, ctx);
    }
    case "lead_series_0":
      return shell(`Welcome to the Free Life Collective, ${name}`, ["We are so glad you are here.", "The portal is where everything happens: the live calls and their replays, the community chats, and the people who will help you take your first steps.", "Sign in with this email address and you will find everything waiting for you."], { label: "Sign in to the portal", url: login }, ctx);
    case "lead_series_1":
      return shell(`${name}, have you looked around the portal yet?`, ["A quick nudge from us. If you have not signed in yet, now is a good moment.", "Finish your profile, say hello in the chats, and watch a replay if you missed a call. Everyone starts as a beginner here, and people are glad to help."], { label: "Sign in", url: login }, ctx);
    case "lead_series_2":
      return shell("What are you hoping to get out of this?", [`Hi ${name}, we would love to know what brought you to the Free Life Collective and what you are hoping for.`, "Just reply to this email with a sentence or two. A real person reads every reply, and it helps us point you to the right call or person."], null, ctx);
    case "lead_series_3":
      return shell(`Ready for the next step, ${name}?`, ["If you have been watching and learning, the best next step is a one-to-one conversation. Sign in and book a time that suits you.", "There is no pressure. It is simply a chance to ask your questions and hear what could work for you."], { label: "Book a call", url: `${ctx.siteUrl}/book` }, ctx);
    default:
      return null;
  }
}
