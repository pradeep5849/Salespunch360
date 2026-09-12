import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { salesHeaderPresentation } from "./sales-header-policy";
describe("Sales workspace header policy",()=>{
 it("presents canonical admin projections distinctly",()=>{expect(salesHeaderPresentation("PRIMARY_ADMIN",null)).toEqual({kind:"ADMIN",label:"Primary Admin"});expect(salesHeaderPresentation("ADMIN",null)).toEqual({kind:"ADMIN",label:"Additional Admin"})});
 it("preserves Manager and Sales presentation",()=>{expect(salesHeaderPresentation("MANAGER","FIELD_MANAGER")?.label).toBe("Sales Manager");expect(salesHeaderPresentation("MANAGER","MANAGER_ONLY")?.label).toBe("Office Manager");expect(salesHeaderPresentation("SALES",null)?.kind).toBe("SALES")});
 it("renders by effective Sales authorization and gates the Accounts switch",()=>{const layout=readFileSync("src/app/workspace/layout.tsx","utf8"),header=readFileSync("src/components/workspace/workspace-header.tsx","utf8");expect(layout).toContain("workspace?.canAccessSales");expect(layout).not.toContain('role!=="COMPANY_ADMIN"');expect(header).toContain("canSwitchWorkspace&&");expect(header).toContain('value="ACCOUNT"')});
});
