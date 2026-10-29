import { PageHeading } from "@/components/PageHeading";
import { AppSteps } from "@/components/settings/AppSteps";
import { PushToggle } from "@/components/settings/PushToggle";
import { InstallApp } from "@/components/settings/InstallApp";
import { requireMember } from "@/lib/auth/guards";

export const instant = false;
export const metadata = { title: "Get the App" };

export default async function AppPage() {
  const { session } = await requireMember();
  return (
    <>
      <PageHeading lede="Put the portal on your home screen so it opens like an app. It's free and no downloading is required.">Add the FLC App on Your Devices</PageHeading>
      <div className="settings" style={{ maxWidth: 760 }}>
        <section className="card-s">
          <h2 className="qh" style={{ marginTop: 0 }}>Install it</h2>
          <InstallApp />
        </section>
        {session.mode === "supabase" ? (
          <section className="card-s">
            <h2 className="qh" style={{ marginTop: 0 }}>Notifications</h2>
            <p className="when" style={{ margin: "0 0 12px" }}>Get a banner on your phone and a number on the app icon for new leads, call reminders, approvals and announcements. On an iPhone, install the app first, then turn this on from inside the app.</p>
            <PushToggle userId={session.user.id} />
          </section>
        ) : null}
        <AppSteps />
      </div>
    </>
  );
}
