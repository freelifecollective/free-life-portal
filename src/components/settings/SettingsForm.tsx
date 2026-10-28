"use client";

import { useActionState } from "react";
import { saveSettings, type SettingsState } from "@/app/(app)/settings/actions";

export function SettingsForm({ first, last, username, email, instagram, facebook, isMember, rank, ranks }: {
  first: string; last: string; username: string; email: string; instagram: string; facebook: string;
  isMember: boolean; rank: number | null; ranks: { id: number; name: string }[];
}) {
  const [state, action, pending] = useActionState(saveSettings, { error: "" } as SettingsState);
  return (
    <form action={action} className="set-form">
      <div className="row">
        <div className="field"><label htmlFor="s-first">First name</label><input id="s-first" name="first" type="text" required maxLength={40} defaultValue={first} /></div>
        <div className="field"><label htmlFor="s-last">Last name</label><input id="s-last" name="last" type="text" required maxLength={40} defaultValue={last} /></div>
      </div>
      <div className="field"><label htmlFor="s-user">Username</label><input id="s-user" name="username" type="text" required minLength={3} maxLength={30} defaultValue={username} autoCapitalize="none" /></div>
      <p className="when" style={{ margin: "-4px 0 0" }}>Your username is also the address of your landing page. Changing it changes that address.</p>
      <div className="field"><label htmlFor="s-email">Email</label><input id="s-email" type="email" value={email} disabled readOnly /></div>
      {isMember ? (
        <>
          <div className="row">
            <div className="field"><label htmlFor="s-ig">Instagram</label><input id="s-ig" name="instagram" type="text" defaultValue={instagram} placeholder="yourhandle" autoCapitalize="none" /></div>
            <div className="field"><label htmlFor="s-fb">Facebook</label><input id="s-fb" name="facebook" type="text" defaultValue={facebook} placeholder="yourpage" autoCapitalize="none" /></div>
          </div>
          <div className="field">
            <label htmlFor="s-rank">Your rank</label>
            <select id="s-rank" name="rank" defaultValue={rank ?? ""}>
              <option value="">Not set</option>
              {ranks.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <p className="when" style={{ margin: "-4px 0 0" }}>Your rank is private. It is only used to match you with others, and on the Water Share Map once that is added.</p>
        </>
      ) : null}
      <div className="set-actions">
        <button className="btn primary" type="submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button>
        <span role="status" className="when">{state.saved ? "Saved." : ""}</span>
      </div>
      <p className="err" role="alert">{state.error}</p>
    </form>
  );
}
