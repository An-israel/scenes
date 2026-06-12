/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ship the bundled font (used by sharp/librsvg for SVG text labels) with the
  // serverless functions — Vercel lambdas have no system fonts.
  experimental: {
    outputFileTracingIncludes: {
      "/api/image": ["./assets/fonts/**"],
    },
  },
};

export default nextConfig;
