import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle at `.next/standalone` so the Docker
  // image can run `node server.js` with only its traced dependencies — no full
  // node_modules, no `next start`. See Dockerfile and DEPLOY.md.
  output: "standalone",
};

export default nextConfig;
