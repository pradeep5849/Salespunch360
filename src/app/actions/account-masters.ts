"use server";
import { revalidatePath } from "next/cache";
import { createAccountCustomerForBranch, createCategory, createFinancialYear, createProduct, createService, createUnit, createWorkCategory, createWorkPackage, setCurrency, updateUnit, setItemsActive, saveUnitConversion,createPartyWithCustomValues } from "@/lib/account/service";

export async function saveAccountMaster(formData:FormData){
 const type=String(formData.get("type")); const raw=Object.fromEntries(formData.entries());
 const customValues=Object.fromEntries([...formData.entries()].filter(([key])=>key.startsWith("custom_")).map(([key,value])=>[key.slice(7),value]));
 const calls:Record<string,(v:unknown)=>Promise<unknown>>={customers:v=>createPartyWithCustomValues("customers",v,customValues),vendors:v=>createPartyWithCustomValues("vendors",v,customValues),units:createUnit,categories:createCategory,products:createProduct,services:createService,"work-categories":createWorkCategory,"work-packages":createWorkPackage,"financial-years":createFinancialYear,currency:setCurrency};
 const call=calls[type]; if(!call)throw new Error("INVALID_MASTER_TYPE"); await call(raw); revalidatePath(`/workspace/account/${type}`); revalidatePath("/workspace/account");
}
export type CreateAccountItemInput={type:"products"|"services";name:string;unitId?:string;categoryId?:string;code?:string;barcode?:string;description?:string;sellingRate?:string;cost?:string;taxRate?:string;hsnSacCode?:string;trackInventory?:boolean;trackingMode?:"NONE"|"BATCH"|"SERIAL";lowStockThreshold?:string};
export async function createAccountItemAction(raw:CreateAccountItemInput){
 const call=raw.type==="products"?createProduct:createService;
 const row=await call({name:raw.name,unitId:raw.unitId,categoryId:raw.categoryId,code:raw.code??"",barcode:raw.barcode,description:raw.description??"",sellingRate:raw.sellingRate??"0",cost:raw.cost??"0",taxRate:raw.taxRate??"0",hsnSacCode:raw.hsnSacCode??"",trackInventory:raw.type==="products"&&Boolean(raw.trackInventory),trackingMode:raw.type==="products"?(raw.trackingMode??"NONE"):"NONE",lowStockThreshold:raw.type==="products"?(raw.lowStockThreshold??"0"):"0"});
 revalidatePath("/workspace/account/inventory");
 return {id:row.id};
}
export async function createAccountUnitAction(raw:{name:string;symbol:string}){const row=await createUnit(raw);revalidatePath("/workspace/account/inventory/items/new");return{id:row.id,name:row.name,symbol:row.symbol}}
export async function createAccountCategoryAction(raw:{name:string;description?:string;scope?:"PRODUCT"|"SERVICE"|"BOTH"}){const row=await createCategory({name:raw.name,description:raw.description,scope:raw.scope??"BOTH"});revalidatePath("/workspace/account/inventory/items/new");return{id:row.id,name:row.name}}
export type CreateSaleCustomerInput={name:string;phone?:string;email?:string;billingAddress?:string;shippingAddress?:string;gstin?:string;stateCode?:string;gstRegistrationType?:"UNREGISTERED"|"REGULAR"|"COMPOSITION"|"SEZ"};
export async function createSaleCustomerAction(branchId:string,raw:CreateSaleCustomerInput){const row=await createAccountCustomerForBranch(branchId,{name:raw.name,phone:raw.phone,email:raw.email,address:raw.billingAddress,shippingAddress:raw.shippingAddress,gstin:raw.gstin,stateCode:raw.stateCode,gstRegistrationType:raw.gstRegistrationType??"UNREGISTERED"});revalidatePath("/workspace/account/transactions/new");return{id:row.id,name:row.name,phone:row.phone,branchId:row.branchId,balance:"0.00"}}


export async function updateAccountUnitAction(id:string,raw:{name:string;symbol:string}){
 const row=await updateUnit(id,raw);revalidatePath("/workspace/account/inventory/units");revalidatePath("/workspace/account/inventory/items/new");return{id:row.id,name:row.name,symbol:row.symbol};
}
export async function setItemsActiveAction(kind:"products"|"services",ids:string[],isActive:boolean){
 const row=await setItemsActive(kind,ids,isActive);revalidatePath("/workspace/account/inventory");revalidatePath("/workspace/account/inventory/items");revalidatePath("/workspace/account/inventory/active");return row;
}
export async function saveUnitConversionAction(raw:{baseUnitId:string;secondaryUnitId:string;rate:string}){
 await saveUnitConversion(raw);revalidatePath("/workspace/account/inventory/units");return{ok:true};
}
