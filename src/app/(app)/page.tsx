import { redirect } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { getSession } from "@/lib/auth/session";

export const instant = false; // renders per signed-in member

export const metadata = { title: "Home" };

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const { profile, mode } = session;
  return (
    <>
      <PageHeading lede="This is your home in the Free Life Collective. More of the portal arrives step by step.">
        Welcome, {profile.first_name}
      </PageHeading>
      <section className="card-s" style={{ maxWidth: 460 }} aria-label="Your profile">
        <ul className="kv">
          <li><span>Username</span><span>@{profile.username}</span></li>
          <li><span>Instagram</span><span>{profile.instagram ? "@" + profile.instagram : "Not added yet"}</span></li>
          <li><span>Facebook</span><span>{profile.facebook ? "@" + profile.facebook : "Not added yet"}</span></li>
        </ul>
        {mode === "preview" ? <p className="status" style={{ marginBottom: 0 }}>Preview mode: nothing here is saved to a real account.</p> : null}
      </section>
    </>
  );
}
