import { describe, expect, it } from "vitest";
import { assertAssignableManager, assertCanActivate, assertManagedEmployee, EmployeePolicyError } from "./policy";

const manager = { id: "manager", companyId: "company-a", salesRole: "MANAGER" as const, salesAccessActive: true, isActive: true };

describe("employee tenant policy", () => {
  it("accepts canonical Manager and Sales employees", () => {
    expect(() => assertManagedEmployee("company-a", manager)).not.toThrow();
    expect(() => assertManagedEmployee("company-a", { ...manager, salesRole: "SALES" })).not.toThrow();
  });
  it("rejects cross-company and role-less identities", () => {
    expect(() => assertManagedEmployee("company-a", { ...manager, companyId: "company-b" })).toThrow(EmployeePolicyError);
    expect(() => assertManagedEmployee("company-a", { ...manager, salesRole: null })).toThrow("NOT_FOUND");
  });
  it.each(["MANAGER", "SALES"] as const)("rejects legacy %s without a canonical Sales role", (role) => {
    expect(() => assertManagedEmployee("company-a", { ...manager, role, salesRole: null } as never)).toThrow("NOT_FOUND");
  });
  it("rejects an Account-only identity", () => {
    expect(() => assertManagedEmployee("company-a", { ...manager, salesRole: null, accountRole: "ACCOUNTANT" } as never)).toThrow("NOT_FOUND");
  });
  it("requires an active Sales-active same-company canonical Manager", () => {
    expect(() => assertAssignableManager("company-a", manager)).not.toThrow();
    expect(() => assertAssignableManager("company-a", { ...manager, companyId: "company-b" })).toThrow("INVALID_MANAGER");
    expect(() => assertAssignableManager("company-a", { ...manager, salesRole: "SALES" })).toThrow("INVALID_MANAGER");
    expect(() => assertAssignableManager("company-a", { ...manager, salesAccessActive: false })).toThrow("INVALID_MANAGER");
    expect(() => assertAssignableManager("company-a", { ...manager, isActive: false })).toThrow("INVALID_MANAGER");
  });
  it("keeps Manager Only assignable because managerType is not an assignment restriction", () => {
    expect(() => assertAssignableManager("company-a", { ...manager, managerType: "MANAGER_ONLY" })).not.toThrow();
  });
});

describe("employee activation policy", () => {
  it.each(["EXPIRED", "SUSPENDED"] as const)("blocks %s lifecycle", (status) => {
    expect(() => assertCanActivate(status, "SALES", 0)).toThrow("LIFECYCLE_BLOCKED");
  });

  it("enforces the Manager trial limit", () => {
    expect(() => assertCanActivate("TRIAL", "MANAGER", 1)).toThrow("SEAT_LIMIT");
    expect(() => assertCanActivate("TRIAL", "MANAGER", 0)).not.toThrow();
  });

  it("enforces the Sales trial limit", () => {
    expect(() => assertCanActivate("TRIAL", "SALES", 5)).toThrow("SEAT_LIMIT");
    expect(() => assertCanActivate("TRIAL", "SALES", 4)).not.toThrow();
  });

  it.each(["MANAGER", "SALES"] as const)("preserves current ACTIVE semantics for %s", (salesRole) => {
    expect(() => assertCanActivate("ACTIVE", salesRole, 10_000)).not.toThrow();
  });
});
