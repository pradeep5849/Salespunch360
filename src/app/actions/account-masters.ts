"use server";
import { revalidatePath } from "next/cache";
import { createAccountCustomer, createCategory, createFinancialYear, createProduct, createService, createUnit, createVendor, createWorkCategory, createWorkPackage, setCurrency } from "@/lib/account/service";

export async function saveAccountMaster(formData:FormData){
 const type=String(formData.get("type")); const raw=Object.fromEntries(formData.entries());
 const calls:Record<string,(v:unknown)=>Promise<unknown>>={customers:createAccountCustomer,vendors:createVendor,units:createUnit,categories:createCategory,products:createProduct,services:createService,"work-categories":createWorkCategory,"work-packages":createWorkPackage,"financial-years":createFinancialYear,currency:setCurrency};
 const call=calls[type]; if(!call)throw new Error("INVALID_MASTER_TYPE"); await call(raw); revalidatePath(`/workspace/account/${type}`); revalidatePath("/workspace/account");
}
