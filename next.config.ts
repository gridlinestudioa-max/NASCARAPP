import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
