import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Disattivato: crash client React #412 / "This page couldn't load" (Next 16 PPR).
  partialPrefetching: false,
  async redirects() {
    return [
      { source: "/", destination: "/dashboard", permanent: false },
      { source: "/login", destination: "/dashboard", permanent: false },
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
