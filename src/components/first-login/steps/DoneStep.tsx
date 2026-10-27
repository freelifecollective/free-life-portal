"use client";

import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { initials, type Env, type Flow } from "../flow";

export function DoneStep({ f, env }: { f: Flow; env: Env }) {
  const router = useRouter();
  return (
    <section className="step final">
      <h1 className="page-heading" tabIndex={-1}>You&rsquo;re in, {f.first}.</h1>
      <p className="page-lede">Here is what the portal saved for you.</p>
      {f.pic ? <Avatar url={f.pic.url} initials={initials(f)} size={150} label="Your profile picture" /> : null}
      <ul className="summary" style={{ marginTop: 24 }}>
        <li><span>Username</span><span>@{f.username}</span></li>
        <li><span>Instagram</span><span>{f.ig ? "@" + f.ig : "Not added yet"}</span></li>
        <li><span>Facebook</span><span>{f.fb ? "@" + f.fb : "Not added yet"}</span></li>
      </ul>
      <div className="actions">
        <button className="btn primary" type="button" onClick={() => { router.replace("/"); router.refresh(); }}>Go to the portal</button>
      </div>
      {env.mode === "preview" ? (
        <form action="/logout" method="post" className="backrow"><button className="linkbtn" type="submit">Preview mode: start over</button></form>
      ) : null}
    </section>
  );
}
