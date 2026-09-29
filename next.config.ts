import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The sandboxed dev container is reached at 127.0.0.1, not localhost —
  // without this, Next's dev-only cross-origin check silently rejects the
  // HMR websocket for that origin, which (in this Next/Turbopack version)
  // takes client-side hydration down with it: every page still renders
  // its server HTML, but no onClick/onMouseEnter handler ever attaches.
  // Never affects the production build (this whole block is dev-only).
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async headers() {
    return [
      {
        // Browsers (and some CDNs) cache a plain static file aggressively
        // by default; without this, a deployed sw.js update can take a
        // long time to actually reach installed users.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
