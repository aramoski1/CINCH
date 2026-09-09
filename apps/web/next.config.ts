import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: [
    "@cinch/api",
    "@cinch/api-client",
    "@cinch/adapters",
    "@cinch/ai",
    "@cinch/commitments",
    "@cinch/database",
    "@cinch/shared",
    "@cinch/ui",
  ],
  serverExternalPackages: ["fastify", "@fastify/cors", "pg-boss", "@anthropic-ai/sdk"],
};

export default nextConfig;
