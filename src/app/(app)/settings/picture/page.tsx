import { FirstLogin } from "@/components/first-login/FirstLogin";
import { requireMember } from "@/lib/auth/guards";

export const instant = false;
export const metadata = { title: "Change your picture" };

export default async function ChangePicture() {
  const { session } = await requireMember();
  const p = session.profile;
  return (
    <div className="account">
    <FirstLogin
      env={{ mode: session.mode, userId: session.user.id }}
      alreadyOnboarded
      pictureOnly={{ first: p.first_name ?? "", last: p.last_name ?? "", username: p.username ?? "" }}
    />
    </div>
  );
}
