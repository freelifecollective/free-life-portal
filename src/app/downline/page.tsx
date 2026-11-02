import { SplashMark } from "@/components/SplashMark";
import { LanguagePicker } from "@/components/LanguagePicker";
import { supabaseConfigured } from "@/lib/env";
import { DownlineForm } from "./DownlineForm";

export const metadata = { title: "Join Lacey's downline" };

export default function DownlinePage() {
  return (
    <main className="splash login-splash">
      <SplashMark />
      {supabaseConfigured ? <DownlineForm /> : <p className="status bad" role="alert">This site is not configured yet. Please contact support.</p>}
      <div className="login-lang"><LanguagePicker variant="list" /></div>
    </main>
  );
}
