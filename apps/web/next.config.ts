import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The shared package ships TypeScript source.
  transpilePackages: ["@guessdrawing/shared"],
};

export default nextConfig;
