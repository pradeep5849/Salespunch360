import { describe, expect, it } from "vitest";
import { employeeRoleDimensions } from "./service";

describe("new employee Sales-role synchronization", () => {
  it("creates Managers with matching legacy and Sales roles", () => {
    expect(employeeRoleDimensions("MANAGER")).toEqual({ role: "MANAGER", salesRole: "MANAGER" });
  });
  it("creates Sales users with matching legacy and Sales roles", () => {
    expect(employeeRoleDimensions("SALES")).toEqual({ role: "SALES", salesRole: "SALES" });
  });
});
