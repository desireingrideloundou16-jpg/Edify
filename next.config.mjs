/** @type {import("next").NextConfig} */
const nextConfig = {
  // Lets a second dev server run side by side (NEXT_DIST_DIR=.next-test).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // next/image isn't used: switching the optimizer off removes the /_next/image attack surface
  // (Next 14 advisories GHSA-9g9p-9gw9-jx7f and the AVIF RCE) until the Next 15 upgrade.
  images: { unoptimized: true },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
