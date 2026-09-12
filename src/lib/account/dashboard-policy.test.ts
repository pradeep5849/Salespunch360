import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DASHBOARD_EXPENSE_TYPES, dashboardCardVisibility } from "./dashboard-policy";
describe("P2 dashboard metric policy",()=>{
 it("counts posted Company expenses but excludes OTHER_INCOME",()=>{expect(DASHBOARD_EXPENSE_TYPES).toEqual(["PROJECT_EXPENSE","OFFICE_EXPENSE","REIMBURSEMENT"]);expect(DASHBOARD_EXPENSE_TYPES).not.toContain("OTHER_INCOME" as never)});
 it.each([[ ["SALES","PURCHASES"],true,true ],[ ["PURCHASES"],false,true ],[ ["SALES"],true,false ],[ [],false,false ]] as const)("gates Sales and Purchase cards for %#",(modules,sales,purchases)=>expect(dashboardCardVisibility(modules)).toMatchObject({sales,purchases}));
 it("preserves optional module gating",()=>expect(dashboardCardVisibility(["EXPENSES","PROJECTS","INVENTORY"])).toMatchObject({expenses:true,projects:true,inventory:true,sales:false,purchases:false}));
 it("applies expense classification to totals and Branch comparison",()=>{const source=readFileSync("src/lib/account/branch-dashboard.ts","utf8");expect(source.match(/DASHBOARD_EXPENSE_TYPES/g)?.length).toBeGreaterThanOrEqual(3)});
});
