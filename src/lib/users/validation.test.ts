import { describe, expect, it } from "vitest";
import { accountRoleSchema, canonicalUserRoleDimensionsSchema, managerTypeSchema, salesRoleSchema } from "./validation";

describe("canonical user role validation", () => {
  it("validates the canonical enum dimensions", () => {
    expect(salesRoleSchema.parse("ADMIN")).toBe("ADMIN");
    expect(accountRoleSchema.parse("PROJECT_MANAGER")).toBe("PROJECT_MANAGER");
    expect(managerTypeSchema.parse("MANAGER_ONLY")).toBe("MANAGER_ONLY");
  });

  it("allows Sales-only, Account-only, and combined identities", () => {
    expect(canonicalUserRoleDimensionsSchema.safeParse({ salesRole: "SALES", accountRole: null, managerType: null }).success).toBe(true);
    expect(canonicalUserRoleDimensionsSchema.safeParse({ salesRole: null, accountRole: "ACCOUNTANT", managerType: null }).success).toBe(true);
    expect(canonicalUserRoleDimensionsSchema.safeParse({ salesRole: "MANAGER", accountRole: "PROJECT_MANAGER", managerType: "MANAGER_ONLY" }).success).toBe(true);
  });

  it("rejects managerType for every non-Manager Sales role", () => {
    expect(canonicalUserRoleDimensionsSchema.safeParse({ salesRole: "SALES", accountRole: null, managerType: "FIELD_MANAGER" }).success).toBe(false);
  });
});
