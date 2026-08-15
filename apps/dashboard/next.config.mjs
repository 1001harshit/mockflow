/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@mockflow/shared-types'],
  // Type-checking still runs and gates the build; lint is skipped here to keep
  // the dev build fast and non-interactive.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
