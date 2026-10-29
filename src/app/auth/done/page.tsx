import { SplashMark } from "@/components/SplashMark";
import { Handoff } from "./Handoff";

export const metadata = { title: "Opening your portal" };
export const instant = false;

export default async function DonePage(props: PageProps<"/auth/done">) {
  const sp = await props.searchParams;
  const raw = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  const next = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  return (
    <main className="splash login-splash" role="status" aria-label="Opening your portal">
      <SplashMark />
      <Handoff next={next} />
    </main>
  );
}
