import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/app3001",
  transpilePackages: ["next-auth"],
  devIndicators: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
