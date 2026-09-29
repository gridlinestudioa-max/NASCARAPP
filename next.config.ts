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
      {
        // Baseline hardening headers, sitewide. Deliberately not a
        // Content-Security-Policy: layout.tsx has a legitimate inline
        // <script> (the no-FOUC theme read, run before paint) that a real
        // CSP would need a per-request nonce to allow — that's a bigger,
        // riskier change than these four, which have no such interaction
        // with anything the app does and are safe to ship as-is.
        source: "/(.*)",
        headers: [
          // Blocks the app from being framed by another site — the classic
          // clickjacking defense (e.g. an invisible iframe overlaying a
          // "Confirm delete" button with attacker-controlled content).
          { key: "X-Frame-Options", value: "DENY" },
          // Stops a browser from guessing/upgrading a response's content
          // type from its content — closes a class of MIME-sniffing XSS
          // where an uploaded "image" is reinterpreted and executed as
          // something else.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Sends the full referrer only to this site's own pages; a link
          // to an external site (or to Venmo, since Settings added one)
          // only leaks the origin, not the full URL a viewer was on.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // This app never asks for the camera, microphone, or the
          // visitor's location — explicitly denying them means an embedded
          // third-party script (an ad, a widget) can't request them either.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
