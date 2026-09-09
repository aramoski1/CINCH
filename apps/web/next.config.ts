import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@cinch/ui", "@cinch/api-client", "@cinch/shared"],
};

export default nextConfig;
