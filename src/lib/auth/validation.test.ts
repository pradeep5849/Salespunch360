import { describe, expect, it } from "vitest";
import { loginSchema, registrationSchema } from "./validation";

describe("authentication validation", () => {
  it("normalizes login email", () => {
    expect(loginSchema.parse({ email: "  Admin@Example.COM ", password: "secret" }).email).toBe("admin@example.com");
  });
  it("accepts a strong registration and normalizes its slug", () => {
    const result = registrationSchema.parse({ companyName: "Acme", companySlug: "Acme-Sales", adminName: "Ada Admin", adminEmail: "ADA@ACME.COM", adminPassword: "StrongPassword1" });
    expect(result.companySlug).toBe("acme-sales");
    expect(result.adminEmail).toBe("ada@acme.com");
  });
  it("rejects browser-supplied role and company fields when strict", () => {
    expect(registrationSchema.safeParse({ companyName: "Acme", companySlug: "acme", adminName: "Ada", adminEmail: "ada@acme.com", adminPassword: "StrongPassword1", role: "SUPER_ADMIN", companyId: "other" }).success).toBe(false);
  });
});
