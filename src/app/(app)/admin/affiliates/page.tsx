import { redirect } from "next/navigation";

/** People and invites now holds this too. */
export default function AffiliatesPage() {
  redirect("/admin/people?view=current");
}
