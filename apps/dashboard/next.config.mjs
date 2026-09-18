/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `next dev` and `next start` both write to .next by default, so running the
  // web dev server and the desktop app from one checkout left each reading the
  // other's output — a dev build served by `next start` 404s every route.
  // NEXT_DIST_DIR keeps the desktop build in its own directory.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  transpilePackages: ['@mockflow/shared-types'],
  // Type-checking still runs and gates the build; lint is skipped here to keep
  // the dev build fast and non-interactive.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
