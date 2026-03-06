/** @type {import('next').NextConfig} */
const nextConfig = {
  // Avoid stale chunk references; use clean build (rm -rf .next node_modules/.cache) if you see fallback/999.js 404s
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
