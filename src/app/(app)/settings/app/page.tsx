import { PageHeading } from "@/components/PageHeading";
import { AppSteps } from "@/components/settings/AppSteps";
import { InstallApp } from "@/components/settings/InstallApp";
import { requireMember } from "@/lib/auth/guards";

export const instant = false;
export const metadata = { title: "The app" };

export default async function AppPage() {
  await requireMember();
  return (
    <>
      <PageHeading lede="Put the portal on your home screen so it opens like an app. It is free and needs no app store.">The app</PageHeading>
      <div className="settings" style={{ maxWidth: 760 }}>
        <section className="card-s">
          <h2 className="qh" style={{ marginTop: 0 }}>Install it</h2>
          <InstallApp />
        </section>
        <AppSteps />
      </div>
    </>
  );
}
