import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { PlacedDocs } from "@/components/documents/PlacedDocs";
import { CopyInvite } from "@/components/dashboard/CopyInvite";
import { requireMember } from "@/lib/auth/guards";
import { isAffiliate } from "@/lib/roles";

export const instant = false;
export const metadata = { title: "Landing Page" };

export default async function LandingPageTab() {
  const { session } = await requireMember();
  if (!isAffiliate(session.profile.role)) redirect("/");
  const username = session.profile.username;
  return (
    <>
      <PageHeading lede="This is the page your leads see when you send them your link. Everything they do on it is tracked to you.">Landing Page</PageHeading>
      <PlacedDocs placement="landing" />
      {!username ? <p className="card-s" style={{ margin: 0 }}>Your page is not ready yet. Choose a username in your profile settings and it will appear here.</p> : (
        <>
          <div className="lp-bar">
            <CopyInvite username={username} />
            <Link className="btn" href={`/${username}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>Open in a new tab</Link>
            <Link className="linkbtn" href="/settings">Change my page photo and details</Link>
          </div>
          <div className="lp-frame"><iframe src={`/${username}`} title="Your landing page" loading="lazy" /></div>
        </>
      )}
    </>
  );
}
