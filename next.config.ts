import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app is client-heavy (IndexedDB), so Cache Components / PPR add nothing here.
  cacheComponents: false,
  serverExternalPackages: ["sharp"],
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
