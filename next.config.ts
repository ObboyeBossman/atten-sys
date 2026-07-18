import type { NextConfig } from "next";
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {},
  // Enable React strict mode for better development experience
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Cloudflare R2 public URL — update with your actual domain
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
      {
        protocol: "https",
        hostname: "*.cloudflarestorage.com",
      },
    ],
  },
  // Expose R2 public URL to the client (non-secret)
  env: {
    R2_PUBLIC_URL: process.env.R2_PUBLIC_URL ?? "",
  },
};

const pwaConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  // Disable PWA in development to avoid service worker caching issues
  disable: process.env.NODE_ENV === "development",
  // Cache pages and assets
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: "NetworkFirst",
      options: {
        cacheName: "atten-sys-cache",
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
  ],
});

export default pwaConfig(nextConfig as any);
