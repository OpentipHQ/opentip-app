import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components stay off. Dashboard, admin, and docs pages read
  // cookies, the host, and the database on each request.
  // 127.0.0.1 is a different dev origin from localhost. Without this,
  // Next blocks the dev client and clicks (the mobile menu) do nothing.
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
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
