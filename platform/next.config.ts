import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    agentUpgrade: "security",
  },
  /* PPR/cacheComponents off: evita crash client "This page couldn't load" (Next 16). */
  cacheComponents: false,
  devIndicators: false,
  /** @react-pdf/renderer richiede runtime Node nativo (locale + Vercel). */
  serverExternalPackages: ["@react-pdf/renderer"],
  async redirects() {
    return [
      { source: "/dashboard", destination: "/app/scenario", permanent: false },
      { source: "/login", destination: "/app/scenario", permanent: false },
      { source: "/app/quadro", destination: "/app/osservatorio", permanent: false },
      // Legacy paths (pre-shell /app/*) — evita 404 su bookmark e link salvati
      { source: "/scenario", destination: "/app/scenario", permanent: false },
      { source: "/osservatorio", destination: "/app/osservatorio", permanent: false },
      { source: "/locali", destination: "/app/news", permanent: false },
      { source: "/news", destination: "/app/news", permanent: false },
      { source: "/quadro", destination: "/app/osservatorio", permanent: false },
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
