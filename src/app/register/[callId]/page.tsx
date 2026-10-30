import { Suspense } from "react";
import { PageHeading } from "@/components/PageHeading";
import { RegisterForm } from "@/components/RegisterForm";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import { formatInZone } from "@/lib/time";
import { LocalTime } from "@/components/calendar/LocalTime";

export const metadata = { title: "Register for the call" };
import { callLength } from "@/lib/calls/length";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PublicCall = { id: string; title: string; description: string | null; starts_at: string; duration_minutes: number; length_label?: string | null };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "56px max(16px, env(safe-area-inset-left)) 64px" }}>
      <div className="label" style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 36 }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--accent)" }} />Free Life Collective
      </div>
      {children}
    </main>
  );
}

async function Content({ params }: { params: PageProps<"/register/[callId]">["params"] }) {
  const { callId } = await params;
  let call: PublicCall | null = null;
  if (supabaseConfigured && UUID.test(callId)) {
    const { data } = await (await createClient()).rpc("public_call", { p_call: callId });
    call = (data as PublicCall | null) ?? null;
  }
  if (!call) {
    return <Shell><PageHeading lede="This call has finished or is not open for registration. Ask whoever sent you the link for the next one.">This call isn&rsquo;t open</PageHeading></Shell>;
  }
  return (
    <Shell>
      <PageHeading lede={`${formatInZone(new Date(call.starts_at))} · ${callLength(call)}`}>{call.title}</PageHeading>
      <p style={{ marginTop: -16 }}><LocalTime iso={call.starts_at} /></p>
      {call.description ? <p className="call-desc" style={{ marginBottom: 28 }}>{call.description}</p> : null}
      <RegisterForm callId={call.id} />
    </Shell>
  );
}

export default function RegisterPage({ params }: PageProps<"/register/[callId]">) {
  return <Suspense fallback={<Shell>{null}</Shell>}><Content params={params} /></Suspense>;
}
