import { describe, expect, it } from "vitest";
import { loginSchema, registrationSchema } from "./validation";

describe("authentication validation", () => {
  const validRegistration = {
    companyName: "Acme",
    companySlug: "acme-sales",
    adminName: "Ada Admin",
    adminEmail: "ada@acme.com",
    adminPassword: "StrongPassword1",
    confirmPassword: "StrongPassword1",
  };

  it("normalizes login email", () => {
    expect(loginSchema.parse({ email: "  Admin@Example.COM ", password: "secret" }).email).toBe("admin@example.com");
  });
  it("accepts a strong registration and normalizes its slug", () => {
    const result = registrationSchema.parse({ companyName: "Acme", companySlug: "Acme-Sales", adminName: "Ada Admin", adminEmail: "ADA@ACME.COM", adminPassword: "StrongPassword1", confirmPassword: "StrongPassword1" });
    expect(result.companySlug).toBe("acme-sales");
    expect(result.adminEmail).toBe("ada@acme.com");
  });
  it("rejects browser-supplied role and company fields when strict", () => {
    expect(registrationSchema.safeParse({ companyName: "Acme", companySlug: "acme", adminName: "Ada", adminEmail: "ada@acme.com", adminPassword: "StrongPassword1", confirmPassword: "StrongPassword1", role: "SUPER_ADMIN", companyId: "other" }).success).toBe(false);
  });

  it("rejects mismatched password confirmation", () => {
    const result = registrationSchema.safeParse({ ...validRegistration, confirmPassword: "DifferentPassword1" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid slugs and email addresses", () => {
    expect(registrationSchema.safeParse({ ...validRegistration, companySlug: "not/a/slug" }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...validRegistration, adminEmail: "invalid" }).success).toBe(false);
  });

  it.each(["role", "companyId", "trialStartedAt", "trialEndsAt", "subscriptionStatus", "managerSeats", "salesSeats"])(
    "rejects client-controlled %s",
    (field) => expect(registrationSchema.safeParse({ ...validRegistration, [field]: "controlled" }).success).toBe(false),
  );
});
