import type { MetadataRoute } from "next";

/** What makes the portal installable: the name, colours and icons a phone uses for the home-screen app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Free Life Collective",
    short_name: "FLC",
    description: "The Free Life Collective community portal.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F6F5F1",
    theme_color: "#F6F5F1",
    related_applications: [{ platform: "webapp", url: "/manifest.webmanifest" }],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
