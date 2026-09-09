import { describe, expect, it } from "vitest";
import { loginSchema, productEditionSchema, registrationSchema } from "./validation";

describe("authentication validation", () => {
  const validRegistration = {
    productEdition: "SALESPUNCH360",
    companyName: "Acme",
    adminName: "Ada Admin",
    adminEmail: "ada@acme.com",
    adminPassword: "StrongPassword1",
    confirmPassword: "StrongPassword1",
  };

  it("normalizes login email", () => {
    expect(loginSchema.parse({ email: "  Admin@Example.COM ", password: "secret" }).email).toBe("admin@example.com");
  });
  it("accepts a strong registration and normalizes its email", () => {
    const result = registrationSchema.parse({ ...validRegistration, adminEmail: "ADA@ACME.COM" });
    expect(result.adminEmail).toBe("ada@acme.com");
  });
  it.each(["SALESPUNCH360_ACCOUNT", "SALESPUNCH360_PLUS", "FORGED"])("rejects unavailable public product %s", productEdition => expect(registrationSchema.safeParse({ ...validRegistration, productEdition }).success).toBe(false));
  it("retains backend awareness of future valid editions",()=>expect(productEditionSchema.options).toEqual(["SALESPUNCH360","SALESPUNCH360_ACCOUNT","SALESPUNCH360_PLUS"]));
  it("rejects browser-supplied role and company fields when strict", () => {
    expect(registrationSchema.safeParse({ ...validRegistration, role: "SUPER_ADMIN", companyId: "other" }).success).toBe(false);
  });

  it("rejects mismatched password confirmation", () => {
    const result = registrationSchema.safeParse({ ...validRegistration, confirmPassword: "DifferentPassword1" });
    expect(result.success).toBe(false);
  });

  it("rejects a registration team structure and requires a valid email address", () => {
    expect(registrationSchema.safeParse({ ...validRegistration, teamStructure: "FORGED" }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...validRegistration, adminEmail: "invalid" }).success).toBe(false);
  });

  it.each(["companySlug", "role", "companyId", "trialStartedAt", "trialEndsAt", "subscriptionStatus", "managerSeats", "salesSeats"])(
    "rejects client-controlled %s",
    (field) => expect(registrationSchema.safeParse({ ...validRegistration, [field]: "controlled" }).success).toBe(false),
  );
});
