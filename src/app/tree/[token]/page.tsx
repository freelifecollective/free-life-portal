import type { Metadata } from "next";
import { Suspense } from "react";
import { SharedTree } from "@/components/tree/SharedTree";
import type { TreeNode } from "@/lib/tree/layout";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Family Tree", robots: { index: false, follow: false } };

async function Content({ params }: { params: PageProps<"/tree/[token]">["params"] }) {
  const { token } = await params;
  const { data } = await (await createClient()).rpc("shared_tree", { p_token: token });
  const rows = (data ?? []) as { owner_name: string; id: string | null; parent_id: string | null; side: "left" | "right"; label: string; rank: string | null }[];
  if (rows.length === 0) {
    return <main className="main" style={{ maxWidth: 640, margin: "60px auto", padding: "0 16px" }}><h1 className="page-heading">This link is not working</h1><p className="page-lede">The owner may have stopped sharing it. Ask them for a new one.</p></main>;
  }
  const nodes: TreeNode[] = rows.filter((r) => r.id).map((r) => ({ id: r.id!, parent_id: r.parent_id, side: r.side, label: r.label, rank: r.rank }));
  return <SharedTree ownerName={rows[0].owner_name} nodes={nodes} />;
}

export default function SharedTreePage(props: PageProps<"/tree/[token]">) {
  return <Suspense fallback={null}><Content params={props.params} /></Suspense>;
}
