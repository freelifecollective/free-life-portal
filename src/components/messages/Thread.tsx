import { UserText } from "@/components/UserText";
import { AttachmentView } from "@/components/attach/AttachmentView";
import { VoiceNote } from "@/components/voice/VoiceNote";
import { DmPicture } from "@/components/messages/DmPicture";
import type { Dm } from "@/lib/messages/queries";
import { formatInZone } from "@/lib/time";

/** The conversation. Under each message you sent: "Sent", or "Read" with the date and time once they opened it. */
export function Thread({ messages, me }: { messages: Dm[]; me: string }) {
  if (messages.length === 0) return <section className="card-s"><p style={{ margin: 0 }}>No messages yet. Say hello!</p></section>;
  return (
    <ul className="thread" aria-label="Messages">
      {messages.map((m) => {
        const mine = m.sender_id === me;
        return (
          <li key={m.id} className={mine ? "mine" : "theirs"}>
            <div className="bubble">{m.forwarded_from ? <span className="fwd-from">Forwarded from <b translate="no">{m.forwarded_from}</b></span> : null}{m.attach_url ? <AttachmentView url={m.attach_url} name={m.attach_name ?? "File"} type={m.attach_type ?? "application/octet-stream"} size={m.attach_size} /> : null}{m.audio_url ? <VoiceNote src={m.audio_url} secs={m.audio_secs} /> : null}{m.image_url ? <DmPicture src={m.image_url} /> : null}<UserText text={m.body} />{m.edited_at ? <i className="dock-edited"> edited</i> : null}</div>
            <span className="when">
              {formatInZone(new Date(m.created_at))}
              {mine ? (m.read_at ? ` · Read ${formatInZone(new Date(m.read_at))}` : " · Sent") : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
