import { describe, expect, it } from "vitest";
import { projectLegacyRole } from "./role-projection";

describe("canonical to legacy role projection", () => {
  it.each([
    ["PRIMARY_ADMIN", "COMPANY_ADMIN"],
    ["ADMIN", "FIELD_ADMIN"],
    ["MANAGER", "MANAGER"],
    ["SALES", "SALES"],
  ] as const)("projects %s to %s", (salesRole, role) => {
    expect(projectLegacyRole({ salesRole, accountRole: null })).toBe(role);
  });

  it("projects an Account-only tenant identity", () => {
    expect(projectLegacyRole({ salesRole: null, accountRole: "ACCOUNTANT" })).toBe("ACCOUNT_USER");
  });

  it("preserves the explicit platform Super Admin identity", () => {
    expect(projectLegacyRole({ salesRole: null, accountRole: null, platformSuperAdmin: true })).toBe("SUPER_ADMIN");
  });

  it("does not accept a legacy role as canonical input", () => {
    expect(() => projectLegacyRole({ salesRole: null, accountRole: null })).toThrow("CANONICAL_ROLE_REQUIRED");
  });
});
