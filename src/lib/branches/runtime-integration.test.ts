import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
import {operationalBranchContext,resolveOperationalWriteBranch} from "./operational-scope";
const actor={id:"user-a",companyId:"company-a",branchAccessScope:"SELECTED_BRANCHES" as const,branchIds:["branch-a"]};
describe("runtime operational Branch integration",()=>{
 it("validates requested Branches for direct service/API principals",async()=>{await expect(resolveOperationalWriteBranch(actor,"branch-a")).resolves.toBe("branch-a");await expect(resolveOperationalWriteBranch(actor,"branch-b")).rejects.toThrow("BRANCH_FORBIDDEN");await expect(operationalBranchContext(actor,"branch-b")).rejects.toThrow("BRANCH_FORBIDDEN")});
 it("requires explicit context for ambiguous writes",async()=>{await expect(resolveOperationalWriteBranch({...actor,branchAccessScope:"ALL_BRANCHES",branchIds:["branch-a","branch-b"]})).rejects.toThrow("BRANCH_REQUIRED")});
 it("wires Branch policy into actual operational and mobile runtime modules",()=>{for(const file of["attendance/service.ts","customers/service.ts","visits/service.ts","leads/service.ts","follow-up-tasks/service.ts","targets/service.ts","reports/attendance.ts","reports/check-ins.ts","reports/gps.ts","reports/leads.ts","reports/geofence.ts","reports/expenses.ts","workspace/dashboard.ts","mobile/attendance.ts","mobile/field.ts"]){const source=readFileSync(`src/lib/${file}`,"utf8");expect(source,`${file} must enforce centralized Branch policy`).toMatch(/operationalBranchContext|resolveOperationalWriteBranch/)}});
 it("keeps Excel authorization on the same Branch-aware report services",()=>{const source=readFileSync("src/app/api/reports/[report]/excel/route.ts","utf8");for(const service of["attendanceReport","checkInReport","leadReport","gpsReport","geofenceReport","listTargetsForActor"])expect(source).toContain(service)});
});
