import { describe, expect, it } from "vitest";
import { canUseCompanyConsolidation } from "./branch-context";

describe("P2 Company consolidation policy",()=>{
 const actor={id:"u",companyId:"c",accountRole:"ACCOUNT_ADMIN" as const,branchAccessScope:"ALL_BRANCHES" as const,branchIds:[]};
 it("requires Account Admin and ALL_BRANCHES together",()=>{expect(canUseCompanyConsolidation(actor)).toBe(true);expect(canUseCompanyConsolidation({...actor,accountRole:"ACCOUNTANT"})).toBe(false);expect(canUseCompanyConsolidation({...actor,branchAccessScope:"SELECTED_BRANCHES"})).toBe(false)});
 it.each(["ACCOUNTANT","PROJECT_MANAGER","DATA_ENTRY"] as const)("does not grant %s an executive Company dashboard",accountRole=>expect(canUseCompanyConsolidation({...actor,accountRole})).toBe(false));
});
