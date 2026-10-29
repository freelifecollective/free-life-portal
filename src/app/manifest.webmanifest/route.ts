import { NextResponse, type NextRequest } from "next/server";

/** What makes the portal installable. Built per request so the address inside it is the real, absolute one (browsers need that to recognise an installed app). */
export function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  return NextResponse.json(
    {
      id: "/",
      name: "Free Life Collective",
      short_name: "FLC",
      description: "The Free Life Collective community portal.",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#F6F5F1",
      theme_color: "#F6F5F1",
      related_applications: [{ platform: "webapp", url: `${origin}/manifest.webmanifest` }],
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } },
  );
}
