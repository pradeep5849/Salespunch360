import { describe, expect, it } from "vitest";
import {
  designationSchema,
  employeeProfileUpdateSchema,
  serializeEmployeeDate,
} from "./employee-profile-validation";

const profile = {
  employeeId: "11111111-1111-4111-8111-111111111111",
  name: " Taylor Sales ",
  email: "TAYLOR@EXAMPLE.COM",
  phone: "+1 (202) 555-0112",
  employeeCode: " sales-7 ",
};

describe("canonical employee profile validation", () => {
  it("makes designation optional, trims it, and treats blank as omitted", () => {
    expect(designationSchema.parse(undefined)).toBeUndefined();
    expect(designationSchema.parse(" Sales Executive ")).toBe("Sales Executive");
    expect(designationSchema.parse("  ")).toBeUndefined();
    expect(designationSchema.safeParse("x".repeat(121)).success).toBe(false);
  });

  it("makes date of joining optional and accepts strict HTML dates", () => {
    expect(employeeProfileUpdateSchema.parse(profile).dateOfJoining).toBeUndefined();
    const parsed = employeeProfileUpdateSchema.parse({ ...profile, dateOfJoining: "2026-09-08" });
    expect(serializeEmployeeDate(parsed.dateOfJoining)).toBe("2026-09-08");
  });

  it.each(["2026-02-29", "2026-13-01", "2026-09-31", "08-09-2026", "2026-9-8"])(
    "rejects invalid calendar date %s",
    (dateOfJoining) => expect(employeeProfileUpdateSchema.safeParse({ ...profile, dateOfJoining }).success).toBe(false),
  );

  it("normalizes shared profile fields and rejects unknown fields", () => {
    const parsed = employeeProfileUpdateSchema.parse(profile);
    expect(parsed).toMatchObject({
      name: "Taylor Sales",
      email: "taylor@example.com",
      phone: "+12025550112",
      employeeCode: "SALES-7",
    });
    expect(employeeProfileUpdateSchema.safeParse({ ...profile, salesRole: "PRIMARY_ADMIN" }).success).toBe(false);
  });
});
