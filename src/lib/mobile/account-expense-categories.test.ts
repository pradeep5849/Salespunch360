import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MobileAppPrincipal } from "./auth";
const m=vi.hoisted(()=>({ permission:vi.fn(), context:vi.fn(), options:vi.fn(), summary:vi.fn() }));
vi.mock("@/lib/auth/permissions",()=>({canUsePermission:m.permission}));
vi.mock("./account-transactions",()=>({mobileAccountActor:(u:unknown)=>u}));
vi.mock("@/lib/account/branch-context",()=>({resolveAccountBranchContext:m.context}));
vi.mock("@/lib/account/expenses",async()=>({recurringTemplateEditInput:(await import("zod")).z.object({}),expenseCategoryOptionsForActor:m.options,expenseSummaryForActor:m.summary}));
import {mobileExpenseCategories} from "./account-expenses";
const principal={id:"user",companyId:"company",productEdition:"SALESPUNCH360_ACCOUNT",accountRole:"ACCOUNT_ADMIN"} as MobileAppPrincipal;
describe("mobile expense category branch totals",()=>{
 beforeEach(()=>{vi.resetAllMocks();m.permission.mockReturnValue(true);m.options.mockResolvedValue({categories:[],ledgers:[],canManage:false});m.summary.mockResolvedValue({expense:"10.00"});});
 it("passes the authorized selected branch to totals and returns its caption",async()=>{
  const context={mode:"BRANCH",branchId:"branch-a",branchName:"A"};m.context.mockResolvedValue({context});
  const result=await mobileExpenseCategories(principal,"search",{branchId:"branch-a"});
  expect(m.context).toHaveBeenCalledWith(principal,{branchId:"branch-a"});
  expect(m.summary).toHaveBeenCalledWith(principal,{branchId:"branch-a"},"search");
  expect(result.branchContext).toEqual(context);
 });
 it("resolves consolidated authorization before unfiltered aggregate",async()=>{
  m.context.mockResolvedValue({context:{mode:"COMPANY",branchId:null,branchName:null}});
  await mobileExpenseCategories(principal,null,{scope:"all"});
  expect(m.context).toHaveBeenCalledWith(principal,{scope:"all"});
  expect(m.summary).toHaveBeenCalledWith(principal,{branchId:undefined},"");
 });
 it("does not read categories or totals for an inaccessible branch",async()=>{
  m.context.mockRejectedValue(new Error("FORBIDDEN"));
  await expect(mobileExpenseCategories(principal,"",{branchId:"foreign"})).rejects.toThrow("FORBIDDEN");
  expect(m.options).not.toHaveBeenCalled();expect(m.summary).not.toHaveBeenCalled();
 });
 it("does not resolve context or read totals without expense permission",async()=>{
  m.permission.mockReturnValue(false);
  await expect(mobileExpenseCategories(principal)).rejects.toThrow("MOBILE_FORBIDDEN");
  expect(m.context).not.toHaveBeenCalled();expect(m.summary).not.toHaveBeenCalled();
 });
 it("exposes creation separately from category administration and view permission",async()=>{m.context.mockResolvedValue({context:{mode:"COMPANY"}});m.permission.mockImplementation((_actor,_edition,permission)=>permission==="ACCOUNT_EXPENSE_VIEW");const result=await mobileExpenseCategories(principal);expect(result.canCreateExpense).toBe(false);expect(result.canManage).toBe(false)});
});
