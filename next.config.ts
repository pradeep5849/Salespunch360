import { contentSecurityPolicy } from "./src/lib/security/headers";
import type { NextConfig } from "next";
const production = process.env.NODE_ENV === "production";
// Google Maps JS requires provider scripts, workers, fonts and image tiles.
const csp = contentSecurityPolicy(production);
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self)",
  },
  { key: "Content-Security-Policy", value: csp },
  ...(production
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
];
const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
  outputFileTracingIncludes: { "/*": ["./assets/fonts/*.ttf"] },
  experimental: {
    // Shared hosting may expose more CPUs than its process memory allowance.
    // Bound Next.js build/export workers without changing runtime requests.
    cpus: 1,
    memoryBasedWorkersCount: false,
    staticGenerationMaxConcurrency: 1,
    serverActions: { bodySizeLimit: "11mb" },
  },
  agentRules: false,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      ...["/workspace/billing/pending", "/payment/sandbox"].map(source => ({source, headers: [{key:"Content-Security-Policy",value:contentSecurityPolicy(production,undefined,true)}]})),
      {
        source: "/workspace/account/transactions/new",
        headers: [
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(self)",
          },
        ],
      },
      {
        source: "/workspace/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
        ],
      },
    ];
  },
};
export default nextConfig;
