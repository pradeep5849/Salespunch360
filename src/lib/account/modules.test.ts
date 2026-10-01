import {describe,expect,it} from "vitest";
import {LEGACY_DEFAULT_ACCOUNT_MODULES,recommendedModulesForBusinessType,validateEnabledModules} from "./modules";
describe("Account module compatibility policy",()=>{
  it("supports all old and new business values",()=>{for(const type of ["INTERIOR_CONSTRUCTION","RETAIL_TRADING","SERVICE_BUSINESS","MANUFACTURING","RESTAURANT_FOOD","WHOLESALE_DISTRIBUTION","PROFESSIONAL_CONSULTANCY","OTHER_MIXED"])expect(recommendedModulesForBusinessType(type)).toContain("SALES")});
  it("rejects an unknown business type",()=>expect(()=>recommendedModulesForBusinessType("UNKNOWN")).toThrow());
  it("retains legacy defaults and core accounting",()=>expect(LEGACY_DEFAULT_ACCOUNT_MODULES).toEqual(expect.arrayContaining(["SALES","PURCHASES","INVENTORY","PROJECTS","PROJECT_COSTING"])));
  it("still validates internal workflow dependencies",()=>{expect(validateEnabledModules(["SALES","SALES_ORDER"])).toEqual(["SALES","SALES_ORDER"]);expect(()=>validateEnabledModules(["SALES_ORDER"])).toThrow("MODULE_DEPENDENCY_REQUIRED")});
});
