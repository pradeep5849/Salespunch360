import { describe, expect, it } from "vitest";
import { PUBLIC_PRODUCT_EDITIONS, productEntitlements, resolveEnabledModules } from "./entitlements";
describe("F4 product and module setup", () => {
  it("publishes all three stable editions", () => { expect(productEntitlements("SALESPUNCH360_PLUS")).toMatchObject({sales:true,account:true}); expect(PUBLIC_PRODUCT_EDITIONS).toEqual(["SALESPUNCH360","SALESPUNCH360_ACCOUNT","SALESPUNCH360_PLUS"]); });
  it("validates Sales module selection server-side and always retains core CRM", () => expect(resolveEnabledModules(["ATTENDANCE", "REPORTS"], "SALESPUNCH360")).toEqual(["SALES_CRM", "ATTENDANCE", "REPORTS"]));
  it("rejects unknown, duplicate, and unavailable-product selections", () => { expect(() => resolveEnabledModules(["INVENTORY"], "SALESPUNCH360")).toThrow("INVALID_MODULE_SELECTION"); expect(() => resolveEnabledModules(["REPORTS", "REPORTS"], "SALESPUNCH360")).toThrow("INVALID_MODULE_SELECTION"); expect(resolveEnabledModules([], "SALESPUNCH360_ACCOUNT")).toEqual([]); });
});
