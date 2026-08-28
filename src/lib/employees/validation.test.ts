import { describe, expect, it } from "vitest";
import { createManagerSchema, createSalesSchema, employeeCodeSchema } from "./validation";

const base = { name: "Morgan Manager", email: "MORGAN@EXAMPLE.COM", phone: "+1 (202) 555-0112", employeeCode: " mgr-01 ", password: "StrongPassword1", confirmPassword: "StrongPassword1" };

describe("employee validation", () => {
  it("validates and normalizes Manager creation", () => {
    const result = createManagerSchema.parse(base);
    expect(result.email).toBe("morgan@example.com");
    expect(result.phone).toBe("+12025550112");
    expect(result.employeeCode).toBe("MGR-01");
  });

  it("validates Sales creation with an optional Manager", () => {
    expect(createSalesSchema.safeParse({ ...base, managerId: "11111111-1111-4111-8111-111111111111" }).success).toBe(true);
    expect(createSalesSchema.safeParse({ ...base, managerId: "not-a-uuid" }).success).toBe(false);
  });

  it.each(["role", "companyId", "isActive"])("rejects client-controlled %s", (field) => {
    expect(createManagerSchema.safeParse({ ...base, [field]: "controlled" }).success).toBe(false);
  });

  it("normalizes optional employee codes and rejects unsafe codes", () => {
    expect(employeeCodeSchema.parse(" sales-007 ")).toBe("SALES-007");
    expect(employeeCodeSchema.safeParse("invalid/code").success).toBe(false);
  });
});
