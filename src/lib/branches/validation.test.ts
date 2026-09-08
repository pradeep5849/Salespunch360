import { describe, expect, it } from "vitest";
import { branchAssignmentSchema } from "./validation";

const employeeId = "11111111-1111-4111-8111-111111111111";
const branchId = "22222222-2222-4222-8222-222222222222";

describe("branch assignment validation", () => {
  it("accepts the two strict canonical input shapes", () => {
    expect(branchAssignmentSchema.parse({ employeeId, branchAccessScope: "ALL_BRANCHES" })).toEqual({ employeeId, branchAccessScope: "ALL_BRANCHES" });
    expect(branchAssignmentSchema.parse({ employeeId, branchAccessScope: "SELECTED_BRANCHES", branchIds: [branchId] })).toEqual({ employeeId, branchAccessScope: "SELECTED_BRANCHES", branchIds: [branchId] });
  });

  it.each([
    { employeeId: "bad", branchAccessScope: "ALL_BRANCHES" },
    { employeeId, branchAccessScope: "ALL_BRANCHES", branchIds: [branchId] },
    { employeeId, branchAccessScope: "SELECTED_BRANCHES", branchIds: [] },
    { employeeId, branchAccessScope: "SELECTED_BRANCHES", branchIds: ["bad"] },
    { employeeId, branchAccessScope: "SELECTED_BRANCHES", branchIds: [branchId, branchId] },
    { employeeId, branchAccessScope: "SELECTED_BRANCHES", branchIds: [branchId], companyId: employeeId },
  ])("rejects malformed, empty, duplicate, or extra assignment data: %#", (input) => {
    expect(branchAssignmentSchema.safeParse(input).success).toBe(false);
  });
});
