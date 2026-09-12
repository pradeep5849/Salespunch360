import {describe,expect,it} from "vitest";
import type {AccountRole,ProductEdition} from "@prisma/client";
import {availableCommercialDocumentTypes} from "./commercial";
import {canUsePermission} from "@/lib/auth/permissions";

const modules=["SALES","SALES_ORDER","PROFORMA_INVOICE","DELIVERY_CHALLAN","CREDIT_NOTE","PURCHASES","PURCHASE_ORDER","PURCHASE_BILLS","DEBIT_NOTE","SUBCONTRACTORS"];
function types(role:AccountRole,enabled=modules){
 const actor={isActive:true,role:"ACCOUNT_USER" as const,companyId:"company",accountRole:role,salesRole:null,managerType:null,salesAccessActive:false,accountAccessActive:true};
 return availableCommercialDocumentTypes(enabled,p=>canUsePermission(actor,"SALESPUNCH360_ACCOUNT" as ProductEdition,p));
}
describe("Y-01 permission-aware commercial create policy",()=>{
 it.each(["ACCOUNT_ADMIN","ACCOUNTANT","DATA_ENTRY"] as AccountRole[])("allows the existing sales and purchase matrix for %s",role=>expect(types(role)).toHaveLength(9));
 it("denies all commercial creation to project managers",()=>expect(types("PROJECT_MANAGER")).toEqual([]));
 it("requires enabled child modules",()=>expect(types("ACCOUNT_ADMIN",["SALES","PURCHASES","PURCHASE_BILLS"])).toEqual(["SALES_INVOICE","PURCHASE_BILL"]));
 it("can represent zero authorized types",()=>expect(availableCommercialDocumentTypes(modules,()=>false)).toEqual([]));
});
