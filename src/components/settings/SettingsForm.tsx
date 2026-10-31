"use client";

import { CountrySelect } from "@/components/CountrySelect";
import { useActionState, useEffect } from "react";
import { celebrateRankUp } from "@/lib/celebrate";
import { saveSettings, type SettingsState } from "@/app/(app)/settings/actions";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function SettingsForm({ first, last, username, email, instagram, facebook, isMember, rank, ranks, birthMonth, birthDay, birthYear, country }: {
  first: string; last: string; username: string; email: string; instagram: string; facebook: string;
  isMember: boolean; rank: number | null; ranks: { id: number; name: string }[]; birthMonth: number | null; birthDay: number | null; birthYear: number | null; country: string;
}) {
  const [state, action, pending] = useActionState(saveSettings, { error: "" } as SettingsState);
  useEffect(() => { if (state.rankUp) celebrateRankUp(state.rankUp); }, [state]);
  return (
    <form action={action} className="set-form">
      <div className="row">
        <div className="field"><label htmlFor="s-first">First name</label><input id="s-first" name="first" type="text" required maxLength={40} defaultValue={first} /></div>
        <div className="field"><label htmlFor="s-last">Last name</label><input id="s-last" name="last" type="text" required maxLength={40} defaultValue={last} /></div>
      </div>
      <div className="field"><label htmlFor="s-user">Username</label><input id="s-user" name="username" type="text" required minLength={3} maxLength={30} defaultValue={username} autoCapitalize="none" /></div>
      <p className="when" style={{ margin: "-4px 0 0" }}>Your username is also the address of your landing page. Changing it changes that address.</p>
      <div className="field"><label htmlFor="s-email">Email</label><input id="s-email" type="email" value={email} disabled readOnly /></div>
      <div className="field"><label htmlFor="s-country">Where do you live?</label><CountrySelect id="s-country" name="country" defaultValue={country} placeholder="Not set" /></div>
      <p className="when" style={{ margin: "-4px 0 0" }}>This will be used to customize certain settings in your account. It fills in by itself when you add yourself to the Water Share Map.</p>
      {isMember ? (
        <>
          <div className="row">
            <div className="field"><label htmlFor="s-ig">Instagram</label><input id="s-ig" name="instagram" type="text" defaultValue={instagram} placeholder="yourhandle" autoCapitalize="none" /></div>
            <div className="field"><label htmlFor="s-fb">Facebook (handle or full link)</label><input id="s-fb" name="facebook" type="text" defaultValue={facebook} placeholder="yourpage, or paste your page link" autoCapitalize="none" /></div>
          </div>
          <div className="set-row4">
            <div className="field"><label htmlFor="s-rank">Your rank</label>
              <select id="s-rank" name="rank" defaultValue={rank ?? ""}>
                <option value="">Not set</option>
                {ranks.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select></div>
            <div className="field"><label htmlFor="s-bm">Birthday month</label>
              <select id="s-bm" name="birth_month" defaultValue={birthMonth ?? ""}><option value="">Not set</option>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></div>
            <div className="field"><label htmlFor="s-bd">Day</label>
              <select id="s-bd" name="birth_day" defaultValue={birthDay ?? ""}><option value="">Not set</option>{Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select></div>
            <div className="field"><label htmlFor="s-by">Year (optional)</label>
              <select id="s-by" name="birth_year" defaultValue={birthYear ?? ""}><option value="">Not set</option>{Array.from({ length: 83 }, (_, i) => 2012 - i).map((y) => <option key={y} value={y}>{y}</option>)}</select></div>
          </div>
          <p className="when" style={{ margin: "-4px 0 0" }}>Your birthday shows on your profile. The year is optional and only shows if you choose one. Your rank is private. It is only used to match you with others, and on the Water Share Map.</p>
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
