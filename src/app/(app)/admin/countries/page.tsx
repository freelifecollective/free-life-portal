import { redirect } from "next/navigation";

/** Members by country now lives inside People and invites. */
export default function CountriesPage() {
  redirect("/admin/people?view=countries");
}
