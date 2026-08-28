import { describe, expect, it } from "vitest";
import { assertAssignableManager, assertCanActivate, assertManagedEmployee, EmployeePolicyError } from "./policy";

const manager = { id: "manager", companyId: "company-a", role: "MANAGER" as const, isActive: true };

describe("employee tenant and lifecycle policy", () => {
  it("rejects cross-company employee access", () => {
    expect(() => assertManagedEmployee("company-a", { ...manager, companyId: "company-b" })).toThrow(EmployeePolicyError);
  });

  it("rejects cross-company, non-Manager, and inactive Manager assignment", () => {
    expect(() => assertAssignableManager("company-a", { ...manager, companyId: "company-b" })).toThrow("INVALID_MANAGER");
    expect(() => assertAssignableManager("company-a", { ...manager, role: "SALES" })).toThrow("INVALID_MANAGER");
    expect(() => assertAssignableManager("company-a", { ...manager, isActive: false })).toThrow("INVALID_MANAGER");
  });

  it("enforces the trial Manager and Sales limits", () => {
    expect(() => assertCanActivate("TRIAL", "MANAGER", 1)).toThrow("SEAT_LIMIT");
    expect(() => assertCanActivate("TRIAL", "SALES", 5)).toThrow("SEAT_LIMIT");
    expect(() => assertCanActivate("TRIAL", "MANAGER", 0)).not.toThrow();
    expect(() => assertCanActivate("TRIAL", "SALES", 4)).not.toThrow();
  });

  it("prevents creation/reactivation for expired and suspended companies", () => {
    expect(() => assertCanActivate("EXPIRED", "SALES", 0)).toThrow("LIFECYCLE_BLOCKED");
    expect(() => assertCanActivate("SUSPENDED", "MANAGER", 0)).toThrow("LIFECYCLE_BLOCKED");
  });

  it("temporarily permits ACTIVE lifecycle users without trial limits", () => {
    expect(() => assertCanActivate("ACTIVE", "SALES", 500)).not.toThrow();
  });
});
