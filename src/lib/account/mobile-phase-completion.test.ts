import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildAccountNavigation, hasAccountNavigationItem } from "./navigation";

const read=(path:string)=>readFileSync(path,"utf8");
const actor={id:"u",companyId:"c",role:"COMPANY_ADMIN",isActive:true,managerType:null,salesRole:null,accountRole:"ACCOUNT_ADMIN",accountAccessActive:true,salesAccessActive:false,branchAccessScope:"ALL_BRANCHES",branchIds:[]} as const;

describe("Account mobile phase completion",()=>{
  it("keeps Module Selection out of the main Menu so the profile menu is its single entry",()=>{
    const navigation=buildAccountNavigation(actor,"SALESPUNCH360_ACCOUNT",[]);
    expect(hasAccountNavigationItem(navigation,"Module Selection","/workspace/account/settings/modules")).toBe(false);
    expect(read("src/app/workspace/account/settings/page.tsx")).not.toContain('href="/workspace/account/settings/modules"');
  });
  it("uses one shared bounded Home service for web and Android",()=>{
    expect(read("src/app/api/v1/mobile/account/home/route.ts")).toContain("mobileAccountHome");
    expect(read("src/lib/mobile/account.ts")).toContain("accountMobileHomeData(actor");
    expect(read("src/lib/account/mobile-home.ts")).toContain("take: 20");
  });
  it("backs dashboard trend, inventory and expense breakdown with aggregates",()=>{
    const dashboard=read("src/lib/account/branch-dashboard.ts"),page=read("src/app/workspace/account/dashboard/page.tsx");
    for(const field of ["salesTrend","currentMonthSales","itemCount","lowStockItems","expenseBreakdown"])expect(dashboard).toContain(field);
    expect(page).not.toContain("[32,48,41,62,56,78,72]");
  });
});
