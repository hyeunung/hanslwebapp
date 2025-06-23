import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@radix-ui/react-dialog"],
  eslint: {
    ignoreDuringBuilds: true,
  },
  /* config options here */
};

export default nextConfig;
