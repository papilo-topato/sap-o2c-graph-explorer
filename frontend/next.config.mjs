/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Also ignore TS errors for speed
    ignoreBuildErrors: true,
  },
  reactCompiler: true,
};

export default nextConfig;
