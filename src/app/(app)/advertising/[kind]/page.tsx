import { notFound } from "next/navigation";
import { ResourceGrid } from "@/components/resources/ResourceGrid";
import { bySlug } from "@/lib/resources/kinds";

export const instant = false;

export default async function AdvertisingPage(props: PageProps<"/advertising/[kind]">) {
  const { kind } = await props.params;
  if (!bySlug(kind)) notFound();
  return <ResourceGrid slug={kind} section="advertising" />;
}
