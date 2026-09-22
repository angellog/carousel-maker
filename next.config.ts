import type { NextConfig } from "next";

/** Baseline security headers applied to every response. CSP is intentionally
 *  omitted here: a strict policy needs a nonce for the inline theme-boot script
 *  and Next's hydration inline scripts, plus allowlisting Google Fonts and
 *  Cloudflare Turnstile — that is a tested change, tracked separately, not a
 *  blind addition that could white-screen production. */
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle at `.next/standalone` so the Docker
  // image can run `node server.js` with only its traced dependencies — no full
  // node_modules, no `next start`. See Dockerfile and DEPLOY.md.
  output: "standalone",
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
