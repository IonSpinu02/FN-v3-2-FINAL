import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* PPR/cacheComponents off: evita crash client "This page couldn't load" (Next 16). */
  cacheComponents: false,
  async redirects() {
    return [
      { source: "/dashboard", destination: "/app/scenario", permanent: false },
      { source: "/login", destination: "/app/scenario", permanent: false },
    ];
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
