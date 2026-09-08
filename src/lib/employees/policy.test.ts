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
  it("rejects blocked lifecycle", () => expect(() => assertCanActivate("EXPIRED", "SALES", 0)).toThrow("LIFECYCLE_BLOCKED"));
});
