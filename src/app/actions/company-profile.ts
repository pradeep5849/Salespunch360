"use server";
import { revalidatePath } from "next/cache";
import { updateCompanyProfile } from "@/lib/company/profile";
import { requirePermissionForMutation } from "@/lib/auth/authorization";
import { companyLogoKey, processCompanyLogo } from "@/lib/company/logo";
import { privateStorage } from "@/lib/storage";
import { db } from "@/lib/db";
export type CompanyProfileState={error?:string;success?:string;fieldErrors?:Record<string,string[]>};
export async function saveCompanyProfile(_:CompanyProfileState,formData:FormData):Promise<CompanyProfileState>{const raw=Object.fromEntries(formData);delete raw.companyLogo;try{await updateCompanyProfile(raw);revalidatePath("/workspace");revalidatePath("/workspace/company-profile");return{success:"Company details saved."};}catch(error){const issues=error&&typeof error==='object'&&'flatten'in error?(error as {flatten:()=>{fieldErrors:Record<string,string[]>}}).flatten().fieldErrors:undefined;return{error:"Review the company details and try again.",fieldErrors:issues};}}

export async function replaceCompanyLogo(_:CompanyProfileState,formData:FormData):Promise<CompanyProfileState>{try{const actor=await requirePermissionForMutation("SALES_SETTINGS");if(!actor.companyId)throw new Error("NOT_FOUND");const file=formData.get("companyLogo");if(!(file instanceof File)||!file.size)throw new Error("LOGO_INVALID");const data=await processCompanyLogo(file),key=companyLogoKey(actor.companyId);await privateStorage().put(key,data);await db.company.update({where:{id:actor.companyId},data:{logoObjectKey:key}});revalidatePath("/workspace");revalidatePath("/workspace/company-profile");return{success:"Company logo updated."};}catch(error){return{error:error instanceof Error&&error.message==="LOGO_INVALID"?"Choose a valid JPEG, PNG, or WebP image up to 5 MB.":"Unable to update the company logo."};}}
