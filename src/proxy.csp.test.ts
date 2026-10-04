import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";
afterEach(() => vi.unstubAllEnvs());
it("uses a fresh server-generated nonce and ignores client-provided nonce headers", () => {
  vi.stubEnv("NODE_ENV", "production");
  const request = () =>
    new NextRequest("https://www.salespunch360.com/sign-in", {
      headers: {
        "x-nonce": "attacker",
        "content-security-policy": "script-src 'unsafe-inline'",
      },
    });
  const first = proxy(request()),
    second = proxy(request());
  const policy = first.headers.get("content-security-policy");
  expect(policy).toContain("'nonce-");
  expect(policy).toContain("'strict-dynamic'");
  expect(policy?.split(";")[1]).not.toContain("unsafe-inline");
  expect(policy).not.toContain("unsafe-eval");
  expect(policy).not.toContain("attacker");
  expect(
    first.headers.get("x-middleware-request-content-security-policy"),
  ).toBe(policy);
  expect(first.headers.get("cache-control")).toContain("no-store");
  expect(second.headers.get("content-security-policy")).not.toBe(policy);
});
it("keeps static marketing pages free of per-request nonces", () => {
  vi.stubEnv("NODE_ENV", "production");
  expect(
    proxy(new NextRequest("https://www.salespunch360.com/")).headers.get(
      "content-security-policy",
    ),
  ).toBeNull();
});
