import { describe, expect, it } from "vitest";
import { PUBLIC_PRODUCT_EDITIONS, SALES_SETUP_MODULES, productEntitlements, resolveEnabledModules } from "./entitlements";
describe("F4 product module setup",()=>{
 it("publishes all three stable editions",()=>{expect(productEntitlements("SALESPUNCH360_PLUS")).toMatchObject({sales:true,account:true});expect(PUBLIC_PRODUCT_EDITIONS).toEqual(["SALESPUNCH360","SALESPUNCH360_ACCOUNT","SALESPUNCH360_PLUS"])});
 it("automatically enables the complete Sales feature set for SalesPunch360",()=>expect(resolveEnabledModules([],"SALESPUNCH360")).toEqual([...SALES_SETUP_MODULES]));
 it("automatically enables the complete Sales feature set for Plus",()=>expect(resolveEnabledModules(["ATTENDANCE"],"SALESPUNCH360_PLUS")).toEqual([...SALES_SETUP_MODULES]));
 it("keeps Account-only Companies free of Sales modules",()=>expect(resolveEnabledModules([],"SALESPUNCH360_ACCOUNT")).toEqual([]));
 it("rejects forged, duplicate, or Account-only Sales module input",()=>{expect(()=>resolveEnabledModules(["INVENTORY"],"SALESPUNCH360")).toThrow("INVALID_MODULE_SELECTION");expect(()=>resolveEnabledModules(["REPORTS","REPORTS"],"SALESPUNCH360")).toThrow("INVALID_MODULE_SELECTION");expect(()=>resolveEnabledModules(["REPORTS"],"SALESPUNCH360_ACCOUNT")).toThrow("MODULE_NOT_AVAILABLE_FOR_PRODUCT")});
});
