import { SplashMark } from "@/components/SplashMark";

export const metadata = { title: "No access" };

/** Where someone who was removed from the portal lands if they try to sign in. */
export default function RemovedPage() {
  return (
    <main className="splash login-splash">
      <SplashMark />
      <p className="splash-tag">Your access has ended</p>
      <p className="login-note">You have been removed from the Free Life Collective portal, so you can no longer use it. If you think this is a mistake, please email freelifeplatform11@gmail.com.</p>
      <form action="/logout" method="post"><button className="btn" type="submit" style={{ marginTop: 14 }}>Sign out</button></form>
    </main>
  );
}
