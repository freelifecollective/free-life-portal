import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Giphy = { id: string; images?: { fixed_height?: { url?: string }; fixed_height_small?: { url?: string } } };

/** GIF search for the chat windows. The Giphy key stays on the server; only signed-in people can search. */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ enabled: false, results: [] }, { status: 401 });
  const key = process.env.GIPHY_API_KEY;
  if (!key) return NextResponse.json({ enabled: false, results: [] });
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 60);
  const url = q
    ? `https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(q)}&limit=24&rating=pg&bundle=messaging_non_clips`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${key}&limit=24&rating=pg&bundle=messaging_non_clips`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return NextResponse.json({ enabled: true, results: [] });
    const json = (await res.json()) as { data?: Giphy[] };
    const results = (json.data ?? []).flatMap((g) => {
      const full = g.images?.fixed_height?.url;
      const small = g.images?.fixed_height_small?.url ?? full;
      return full && small && /^https:\/\/media\d*\.giphy\.com\//.test(full) ? [{ id: g.id, url: full.split("?")[0], preview: small }] : [];
    });
    return NextResponse.json({ enabled: true, results });
  } catch {
    return NextResponse.json({ enabled: true, results: [] });
  }
}
