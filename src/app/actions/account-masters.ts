"use server";
import { revalidatePath } from "next/cache";
import { createAccountCustomer, createAccountCustomerForBranch, createCategory, createFinancialYear, createProduct, createService, createUnit, createVendor, createWorkCategory, createWorkPackage, setCurrency } from "@/lib/account/service";

export async function saveAccountMaster(formData:FormData){
 const type=String(formData.get("type")); const raw=Object.fromEntries(formData.entries());
 const calls:Record<string,(v:unknown)=>Promise<unknown>>={customers:createAccountCustomer,vendors:createVendor,units:createUnit,categories:createCategory,products:createProduct,services:createService,"work-categories":createWorkCategory,"work-packages":createWorkPackage,"financial-years":createFinancialYear,currency:setCurrency};
 const call=calls[type]; if(!call)throw new Error("INVALID_MASTER_TYPE"); await call(raw); revalidatePath(`/workspace/account/${type}`); revalidatePath("/workspace/account");
}
export async function createAccountItemAction(raw:{type:"products"|"services";name:string;unitId?:string}){
 const call=raw.type==="products"?createProduct:createService;
 const row=await call({name:raw.name,unitId:raw.unitId,code:"",description:"",sellingRate:"0",cost:"0",taxRate:"0",hsnSacCode:""});
 revalidatePath("/workspace/account/inventory");
 return {id:row.id};
}
export async function createSaleCustomerAction(branchId:string,raw:{name:string;phone?:string}){const row=await createAccountCustomerForBranch(branchId,raw);revalidatePath("/workspace/account/transactions/new");return{id:row.id,name:row.name,phone:row.phone,branchId:row.branchId,balance:"0.00"}}
