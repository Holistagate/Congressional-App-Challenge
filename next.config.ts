import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is deliberately off. Almost every route here is
  // request-scoped (a session, a live listing list, a countdown), so there is
  // very little worth prerendering, and turning it on would mean wrapping every
  // route in Suspense plus `use cache: private` for session reads. See
  // node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md
  // if you ever want to adopt it; README "Assumptions" explains the tradeoff.
  cacheComponents: false,
  partialPrefetching: false,

  // Keep the libSQL packages out of the bundle. The Node build ships a
  // per-platform native binary, and bundling a .node file into a serverless
  // function is how "works locally, fails on Vercel" happens. Marked external
  // so it is required at runtime, on the one code path that needs it.
  serverExternalPackages: ["@libsql/client", "libsql"],

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  images: {
    // Everything we serve is local and already sized by scripts/build-assets.mjs.
    formats: ["image/webp"],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            // We promise seekers we never ask for location. Enforce it at the
            // header so a future dependency cannot quietly start asking.
            value: "geolocation=(), camera=(), microphone=(), interest-cohort=()",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
