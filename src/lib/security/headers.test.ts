import { describe, expect, it } from "vitest";
import { contentSecurityPolicy } from "./headers";
describe("content security policy", () => {
  it("blocks dynamic evaluation in production", () => {
    const policy = contentSecurityPolicy(true);
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("https://maps.googleapis.com");
    expect(policy).toContain("upgrade-insecure-requests");
  });
  it("allows development tooling without forcing localhost to HTTPS", () => {
    expect(contentSecurityPolicy(false)).toContain("'unsafe-eval'");
    expect(contentSecurityPolicy(false)).not.toContain(
      "upgrade-insecure-requests",
    );
  });
});
