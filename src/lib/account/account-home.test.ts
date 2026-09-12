import { describe, expect, it } from "vitest";
import { accountHomeScopes, accountQuickActionHref } from "./account-home";
const admin={id:"admin",companyId:"company",accountRole:"ACCOUNT_ADMIN" as const,branchAccessScope:"ALL_BRANCHES" as const};
describe("Account Home normalized Branch context",()=>{
 it.each(["branch-a","branch-b"])("filters every recent-data query to %s",branchId=>{const scopes=accountHomeScopes(admin,{mode:"BRANCH",branchId,branchName:branchId});expect(scopes.document).toMatchObject({companyId:"company",branchId});expect(scopes.project).toMatchObject({companyId:"company",branchId});expect(scopes.expense).toMatchObject({companyId:"company",branchId})});
 it("allows authorized Company context without inventing a Branch",()=>{const context={mode:"COMPANY" as const,branchId:null,branchName:null};const scopes=accountHomeScopes(admin,context);expect(scopes.document).not.toHaveProperty("branchId");expect(accountQuickActionHref("/new",context)).toBe("/new")});
 it("combines Project Manager and Branch scope",()=>{const scopes=accountHomeScopes({...admin,id:"pm",accountRole:"PROJECT_MANAGER"},{mode:"BRANCH",branchId:"branch-a",branchName:"A"});expect(scopes.project).toMatchObject({branchId:"branch-a",projectManagerId:"pm"});expect(scopes.document).toMatchObject({branchId:"branch-a",project:{is:{projectManagerId:"pm"}}});expect(scopes.expense).toMatchObject({branchId:"branch-a",project:{is:{projectManagerId:"pm"}}})});
 it("passes a selected Branch to Branch-bound quick actions",()=>expect(accountQuickActionHref("/new?type=invoice",{mode:"BRANCH",branchId:"branch a",branchName:"A"})).toBe("/new?type=invoice&branchId=branch%20a"));
});
