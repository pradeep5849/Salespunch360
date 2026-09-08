import { describe, expect, it } from "vitest";
import { canManageEmployeeTravel, isManagerEmployee, isSalesEmployee } from "./presentation";

describe("employee page canonical presentation policy", () => {
  it("uses salesRole rather than legacy role for Manager/Sales identity", () => {
    expect(isManagerEmployee({ salesRole: "MANAGER" })).toBe(true);
    expect(isSalesEmployee({ salesRole: "SALES" })).toBe(true);
    expect(isManagerEmployee({ salesRole: null, role: "MANAGER" } as never)).toBe(false);
    expect(isSalesEmployee({ salesRole: null, role: "SALES" } as never)).toBe(false);
  });

  it("shows employee Travel controls only to the Primary Admin", () => {
    expect(canManageEmployeeTravel("PRIMARY_ADMIN")).toBe(true);
    expect(canManageEmployeeTravel("ADMIN")).toBe(false);
    expect(canManageEmployeeTravel("MANAGER")).toBe(false);
    expect(canManageEmployeeTravel("SALES")).toBe(false);
    expect(canManageEmployeeTravel(null)).toBe(false);
  });
});
