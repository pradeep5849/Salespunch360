import { randomBytes } from "node:crypto";
import { contentSecurityPolicy } from "./lib/security/headers";
import { NextResponse, type NextRequest } from "next/server";

const recognized =
  /^(salespunch360\.com|www\.salespunch360\.com)(?::([1-9][0-9]{0,4}))?$/i;
function normalizeHost(value: string | null) {
  if (!value) return null;
  const candidate = value.trim();
  const match = recognized.exec(candidate);
  if (!match) return null;
  if (match[2] && Number(match[2]) > 65535) return null;
  return match[1].toLowerCase();
}
function requestHost(request: NextRequest) {
  const direct =
    normalizeHost(request.headers.get("host")) ??
    normalizeHost(request.nextUrl.host);
  if (process.env.TRUST_PROXY !== "true") return direct;
  const forwarded =
    request.headers.get("x-forwarded-host")?.split(",")[0] ?? null;
  return normalizeHost(forwarded) ?? direct;
}
function passThrough(request: NextRequest) {
  if (
    !/^\/(workspace|admin)(\/|$)|^\/(sign-in|register)(\/|$)/.test(
      request.nextUrl.pathname,
    )
  )
    return NextResponse.next();
  const nonce = randomBytes(24).toString("base64");
  const policy = contentSecurityPolicy(true, nonce);
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") return NextResponse.next();
  const host = requestHost(request);
  if (host !== "salespunch360.com") return passThrough(request);
  if (request.nextUrl.pathname.startsWith("/api/"))
    return NextResponse.json(
      { error: "CANONICAL_API_HOST_REQUIRED" },
      { status: 421 },
    );
  // Never redirect a mutation at the application layer. In particular, Next.js
  // Server Actions use POST requests whose redirect protocol must be handled by
  // Next itself; turning that POST into an HTTP redirect can make a reverse
  // proxy attempt (and fail) to fetch the redirect response.
  if (request.method !== "GET" && request.method !== "HEAD")
    return passThrough(request);
  const canonical = request.nextUrl.clone();
  canonical.protocol = "https:";
  canonical.host = "www.salespunch360.com";
  return NextResponse.redirect(canonical, 308);
}
export const config = { matcher: "/:path*" };
