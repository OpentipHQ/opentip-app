import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components stay off. Dashboard, admin, and docs pages read
  // cookies, the host, and the database on each request.
  // 127.0.0.1 is a different dev origin from localhost. Without this,
  // Next blocks the dev client and clicks (the mobile menu) do nothing.
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
  experimental: {
    // Profile uploads are capped at 2 MB by application validation. Leave
    // room for multipart boundaries and part headers.
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
