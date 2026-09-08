import { describe, expect, it } from "vitest";
import { transferPrimaryAdminSchema } from "./primary-admin-validation";

describe("Primary Admin transfer validation", () => {
  it("accepts exactly one server-safe UUID target field", () => {
    const input = { targetUserId: "4f0ef50d-d8a6-4b31-8d8d-cb87c1c6ed60" };
    expect(transferPrimaryAdminSchema.parse(input)).toEqual(input);
    expect(() => transferPrimaryAdminSchema.parse({ ...input, companyId: "company-a" })).toThrow();
    expect(() => transferPrimaryAdminSchema.parse({ targetUserId: "target" })).toThrow();
  });
});
