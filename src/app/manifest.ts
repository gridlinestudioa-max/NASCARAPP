import type { MetadataRoute } from "next";

// Auto-detected by Next.js (app/manifest.ts convention) and served at
// /manifest.webmanifest with a <link rel="manifest"> injected into <head>
// automatically — nothing else needs to reference this file. Icons are
// separate flat PNGs in public/ (not the app/icon.svg favicon convention)
// since a manifest needs concrete pixel sizes it can point a URL at.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fantasy NASCAR HQ",
    short_name: "NASCAR HQ",
    description: "Pick'em and Tiered Draft fantasy NASCAR leagues.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2e2e2e",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
