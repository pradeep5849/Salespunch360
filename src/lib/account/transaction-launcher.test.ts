import {expect,it} from "vitest";
import type {AccountModule} from "@prisma/client";
import {transactionLauncherForRole,TRANSACTION_LAUNCHER} from "./transaction-launcher";
const modules=[...new Set(TRANSACTION_LAUNCHER.flatMap(group=>group.actions.flatMap(action=>action.modules)))] as AccountModule[];
it("maps the reference 9 / 5 / 3 actions to existing workflows",()=>{
 const groups=transactionLauncherForRole("ACCOUNT_ADMIN",modules);
 expect(groups.map(group=>group.actions.length)).toEqual([9,5,3]);
 expect(groups.flatMap(group=>group.actions).find(action=>action.label==="Mobile POS")).toMatchObject({disabled:true});
 expect(groups.flatMap(group=>group.actions).find(action=>action.label==="Other Income")?.href).toContain("type=OTHER_INCOME");
});
it("filters by current role and optional modules and keeps selected branch context",()=>{
 const entry=transactionLauncherForRole("DATA_ENTRY",modules).flatMap(group=>group.actions);
 expect(entry.some(action=>action.label==="Payment-In"||action.label==="Purchase Assets"||action.label==="Other Income")).toBe(false);
 expect(entry.some(action=>action.label==="Sale Invoice")).toBe(true);
 const actions=transactionLauncherForRole("ACCOUNTANT",modules.filter(module=>module!=="ASSETS"),"branch-a").flatMap(group=>group.actions);
 expect(actions.some(action=>action.label.endsWith("Assets"))).toBe(false);
 for(const action of actions.filter(action=>action.href))expect(new URL(action.href!,"https://example.test").searchParams.get("branchId")).toBe("branch-a");
 expect(transactionLauncherForRole(null,modules)).toEqual([]);
});
