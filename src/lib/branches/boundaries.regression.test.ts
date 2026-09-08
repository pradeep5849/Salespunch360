import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const assignment = readFileSync("src/lib/branches/assignment.ts", "utf8");
const employeeService = readFileSync("src/lib/employees/service.ts", "utf8");

describe("F3J boundaries and lifecycle preservation", () => {
  it("serializes on the user row and wraps every public mutation in one serializable transaction", () => {
    expect(assignment).toMatch(/FROM "users"[\s\S]*FOR UPDATE/);
    expect(assignment.indexOf("FOR UPDATE")).toBeLessThan(assignment.indexOf("tx.user.findFirst"));
    expect(assignment).toContain("TransactionIsolationLevel.Serializable");
  });

  it("writes only assignment scope and join rows", () => {
    for (const field of ["salesRole:", "role:", "accountRole:", "accountAccessActive:", "managerId:", "managerType:", "designation:", "dateOfJoining:", "phone:", "employeeCode:", "isActive:", "salesAccessActive:", "travelAllowanceEnabled:", "passwordHash:", "sessionVersion:"]) {
      expect(assignment.slice(assignment.indexOf("export async function replaceBranchAssignment"))).not.toContain(`data: { ${field}`);
    }
  });

  it("employee deactivate/reactivate operations do not erase branch metadata", () => {
    const lifecycle = employeeService.slice(employeeService.indexOf("export async function deactivateEmployee"), employeeService.indexOf("export async function resetEmployeePassword"));
    expect(lifecycle).not.toContain("branchAccessScope");
    expect(lifecycle).not.toContain("userBranchAccess");
    expect(lifecycle).not.toContain("branchAccesses");
  });
});
