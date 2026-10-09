import {describe,expect,it} from "vitest";
import {buildAccountNavigation,hasAccountNavigationItem} from "./navigation";
import type {WorkspacePrincipal} from "@/lib/auth/workspace-policy";
const actor=(accountRole:string)=>({companyId:"company",role:"ACCOUNT_USER",salesRole:null,accountRole,salesAccessActive:false,accountAccessActive:true,isActive:true}) as WorkspacePrincipal;
describe("A044-F01/F02/F03 shared web/native navigation",()=>{
 it.each(["ACCOUNT_ADMIN","ACCOUNTANT"])("places authorized %s Assets under Cash & Bank",role=>{const nav=buildAccountNavigation(actor(role),"SALESPUNCH360_ACCOUNT",["ASSETS"]);expect(nav.find(g=>g.label==="Cash & Bank")?.items.some(i=>i.href==="/workspace/account/assets")).toBe(true);expect(nav.find(g=>g.label==="Accounting")?.items.some(i=>i.href==="/workspace/account/assets")).not.toBe(true)});
 it.each(["ACCOUNT_ADMIN","ACCOUNTANT","DATA_ENTRY","PROJECT_MANAGER"])("hides disabled Assets for %s",role=>expect(hasAccountNavigationItem(buildAccountNavigation(actor(role),"SALESPUNCH360_ACCOUNT",[]),"Assets","/workspace/account/assets")).toBe(false));
 it.each(["DATA_ENTRY","PROJECT_MANAGER"])("hides enabled Assets from denied %s",role=>expect(hasAccountNavigationItem(buildAccountNavigation(actor(role),"SALESPUNCH360_ACCOUNT",["ASSETS"]),"Assets","/workspace/account/assets")).toBe(false));
});
