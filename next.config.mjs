/** @type {import("next").NextConfig} */
const nextConfig = {
  // Lets a second dev server run side by side (NEXT_DIST_DIR=.next-test).
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
