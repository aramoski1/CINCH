import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@cinch/ui", "@cinch/api-client", "@cinch/shared"],
};

export default nextConfig;
