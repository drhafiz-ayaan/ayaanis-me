import type { NextConfig } from "next";

const APEX = "ayaanaatif.me";

const nextConfig: NextConfig = {
  /**
   * The floating Next.js dev badge sits in the bottom-left corner, on top of
   * the landing. It never ships to production, but it obscures the cinematic
   * while the thing is being built and reviewed, which is when it matters.
   */
  devIndicators: false,

  /**
   * Canonical host redirect.
   *
   * Vercel can do this itself when the domain is configured as a redirect, but
   * pinning it here means the apex stays canonical regardless of how the
   * dashboard is set, and it is a 308 rather than Vercel's 307 — permanent, so
   * search engines transfer signals to the apex instead of treating the move
   * as temporary.
   *
   * This only takes effect once www has a TLS certificate; without the domain
   * registered in the Vercel project, the handshake fails before any redirect
   * can be served.
   */
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: `www.${APEX}` }],
        destination: `https://${APEX}/:path*`,
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        // The portrait cloud never changes without a filename change.
        source: "/avatar/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
