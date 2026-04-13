// next.config.ts

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/admin",
        destination: "/myadminportal/dashboard",
        permanent: false,
      },
      {
        source: "/admin/:path*",
        destination: "/myadminportal/:path*",
        permanent: false,
      },
    ];
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "api.dicebear.com",
        port: "",
        pathname: "/**",
      },
    ],
  },

  experimental: {
    serverMinification: false,
  },

  // Required for Firebase Studio / Cloudworkstations dev preview.
  // Allows Next.js dev server to serve /_next/* assets to the studio proxy
  // which accesses the app from a different origin than the app port.
  allowedDevOrigins: [
    "*.cloudworkstations.dev",
    "*.firebase-studio-*.cloudworkstations.dev",
    "*.cluster-*.cloudworkstations.dev",
  ],
};

export default nextConfig;